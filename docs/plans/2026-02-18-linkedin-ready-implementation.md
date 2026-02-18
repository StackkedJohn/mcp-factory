# LinkedIn-Ready Production-Grade Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 7 issues preventing generated MCP servers from working against real APIs, using Spotify as the demo target.

**Architecture:** Insert a context-builder preprocessing layer between the analyzer and templates. This transforms raw APISchema + DetectedPatterns into a render-ready TemplateContext with params pre-sorted, tool names cleaned, and auth config fully preserved. Templates become simple loops.

**Tech Stack:** TypeScript, Handlebars, Zod, Node test runner, MCP SDK

---

## Task 1: Add `integer` to SchemaType and add $ref resolution to parser

The OpenAPI spec uses `integer` as a type but our SchemaType union doesn't include it. Also, `$ref` parameters are silently skipped. Fix both.

**Files:**
- Modify: `src/schema/api-schema.ts:58`
- Modify: `src/parsers/openapi.ts:178-181,204-245`

**Step 1: Add `integer` to SchemaType union**

In `src/schema/api-schema.ts:58`, change:
```typescript
type: 'string' | 'number' | 'boolean' | 'object' | 'array';
```
to:
```typescript
type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
```

**Step 2: Add $ref resolution to parseOpenAPI**

In `src/parsers/openapi.ts`, the `parseOpenAPI` function receives the full `spec` object but doesn't pass it down. Thread `spec` through to `parseParameters` and `parseSchema` so they can resolve `$ref`.

Add this function near the top of the file (after imports):
```typescript
function resolveRef(spec: any, ref: string): any {
  const parts = ref.replace('#/', '').split('/');
  let current = spec;
  for (const part of parts) {
    current = current?.[part];
    if (!current) return {};
  }
  return current;
}
```

Update `parseParameters` (line 176) to accept `spec`:
```typescript
function parseParameters(params: any[], spec: any): Parameter[] {
  return params.map((param) => {
    if (param.$ref) {
      param = resolveRef(spec, param.$ref);
    }
    if (!['path', 'query', 'header'].includes(param.in)) {
      return null;
    }
    const schema = param.schema || { type: param.type };
    return {
      name: param.name,
      in: param.in as 'path' | 'query' | 'header',
      required: param.required || false,
      description: param.description || '',
      schema: parseSchema(schema, spec),
    };
  }).filter(Boolean) as Parameter[];
}
```

Update `parseSchema` (line 204) to accept `spec`:
```typescript
function parseSchema(schema: any, spec?: any): SchemaType {
  if (!schema) return { type: 'string' };
  if (schema.$ref && spec) {
    schema = resolveRef(spec, schema.$ref);
  }
  // ... rest unchanged, but pass spec to recursive parseSchema calls
}
```

Update all call sites in `parseOperation` and `parseEndpoints` to pass `spec` through.

**Step 3: Verify it builds**

Run: `npm run build`
Expected: Clean compile, no errors.

**Step 4: Commit**

```bash
git add src/schema/api-schema.ts src/parsers/openapi.ts
git commit -m "fix: add integer type and $ref resolution to parser"
```

---

## Task 2: Create context-builder with smart tool naming

The core new file. Transforms raw APISchema into a TemplateContext with clean tool names, separated params, and full auth config.

**Files:**
- Create: `src/generator/context-builder.ts`
- Modify: `src/schema/api-schema.ts` (add new interfaces)

**Step 1: Add TemplateContext types to api-schema.ts**

Append to `src/schema/api-schema.ts`:
```typescript
export interface ParamContext {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface EndpointContext {
  toolName: string;
  description: string;
  method: string;
  pathTemplate: string;
  pathParams: ParamContext[];
  queryParams: ParamContext[];
  bodyParams: ParamContext[];
  hasBody: boolean;
  allParams: ParamContext[];
  requiredParams: string[];
}

export interface TemplateContext {
  name: string;
  baseUrl: string;
  auth: AuthConfig;
  endpoints: EndpointContext[];
  patterns: DetectedPatterns;
  absolutePath?: string;
  envPrefix: string;
}
```

**Step 2: Create `src/generator/context-builder.ts`**

```typescript
import { APISchema, DetectedPatterns, Endpoint, TemplateContext, EndpointContext, ParamContext } from '../schema/api-schema.js';

export function buildTemplateContext(
  schema: APISchema,
  patterns: DetectedPatterns,
  absolutePath?: string
): TemplateContext {
  const usedNames = new Map<string, number>();

  return {
    name: schema.name,
    baseUrl: schema.baseUrl,
    auth: schema.auth,
    endpoints: schema.endpoints.map(ep => buildEndpoint(ep, usedNames)),
    patterns,
    absolutePath,
    envPrefix: toEnvPrefix(schema.name),
  };
}

function buildEndpoint(ep: Endpoint, usedNames: Map<string, number>): EndpointContext {
  const toolName = generateToolName(ep, usedNames);

  const pathParams: ParamContext[] = ep.parameters
    .filter(p => p.in === 'path')
    .map(toParamContext);

  const queryParams: ParamContext[] = ep.parameters
    .filter(p => p.in === 'query')
    .map(toParamContext);

  const bodyParams: ParamContext[] = [];
  if (ep.requestBody?.schema?.properties) {
    for (const [name, schema] of Object.entries(ep.requestBody.schema.properties)) {
      bodyParams.push({
        name,
        type: schema.type || 'string',
        required: ep.requestBody.schema.required?.includes(name) || false,
        description: '',
      });
    }
  }

  const allParams = [...pathParams, ...queryParams, ...bodyParams];
  const requiredParams = allParams.filter(p => p.required).map(p => p.name);
  const hasBody = bodyParams.length > 0 || ['POST', 'PUT', 'PATCH'].includes(ep.method);

  return {
    toolName,
    description: ep.description,
    method: ep.method,
    pathTemplate: ep.path,
    pathParams,
    queryParams,
    bodyParams,
    hasBody,
    allParams,
    requiredParams,
  };
}

function toParamContext(p: { name: string; schema: { type: string }; required: boolean; description?: string }): ParamContext {
  return {
    name: p.name,
    type: p.schema.type || 'string',
    required: p.required,
    description: p.description || '',
  };
}

function generateToolName(ep: Endpoint, usedNames: Map<string, number>): string {
  let name = ep.id;

  const isAutoGenerated = /Using(GET|POST|PUT|PATCH|DELETE)$/i.test(name)
    || /^(get|post|put|patch|delete|list|add|update|remove|create|link|search)_\d+$/i.test(name)
    || /^(get|post|put|patch|delete)_[/_]/.test(name);

  if (isAutoGenerated || !name) {
    name = deriveFromPath(ep.method, ep.path);
  }

  const count = usedNames.get(name) || 0;
  usedNames.set(name, count + 1);
  if (count > 0) {
    name = `${name}_${count + 1}`;
  }

  return name;
}

function deriveFromPath(method: string, path: string): string {
  const segments = path
    .split('/')
    .filter(s => s && !s.startsWith('{'));

  const resource = segments.length > 0
    ? segments[segments.length - 1]
    : 'resource';

  const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
  const hasPathParam = path.includes('{');

  const methodMap: Record<string, string> = {
    GET: hasPathParam ? `get${capitalize(singular)}` : `list${capitalize(resource)}`,
    POST: `create${capitalize(singular)}`,
    PUT: `update${capitalize(singular)}`,
    PATCH: `update${capitalize(singular)}`,
    DELETE: `delete${capitalize(singular)}`,
  };

  return methodMap[method] || `${method.toLowerCase()}${capitalize(resource)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toEnvPrefix(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}
```

**Step 3: Verify it builds**

Run: `npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add src/generator/context-builder.ts src/schema/api-schema.ts
git commit -m "feat: add context-builder with smart tool naming and param separation"
```

---

## Task 3: Rewrite `client.ts.hbs` template

New client with path param substitution, query string building, and proper auth injection. Uses native `fetch` (Node 18+) instead of `node-fetch`.

**Files:**
- Rewrite: `templates/client.ts.hbs`
- Modify: `templates/package.json.hbs` (remove node-fetch dep)

**Step 1: Rewrite the template**

Replace `templates/client.ts.hbs` entirely with:

```handlebars
export interface RequestOptions {
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
}

export interface APIClient {
  baseUrl: string;
  request: (method: string, pathTemplate: string, options?: RequestOptions) => Promise<any>;
}

export function createClient(baseUrl: string): APIClient {
  return {
    baseUrl,
    async request(method: string, pathTemplate: string, options: RequestOptions = {}) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      {{#if (eq auth.type 'api-key')}}
      {{#if (eq auth.location 'header')}}
      if (process.env.{{envPrefix}}_API_KEY) {
        headers['{{auth.name}}'] = process.env.{{envPrefix}}_API_KEY;
      }
      {{/if}}
      {{/if}}
      {{#if (eq auth.type 'bearer')}}
      if (process.env.{{envPrefix}}_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.{{envPrefix}}_TOKEN}`;
      }
      {{/if}}
      {{#if (eq auth.type 'oauth')}}
      if (process.env.{{envPrefix}}_ACCESS_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.{{envPrefix}}_ACCESS_TOKEN}`;
      }
      {{/if}}
      {{#if (eq auth.type 'basic')}}
      if (process.env.{{envPrefix}}_USER && process.env.{{envPrefix}}_PASS) {
        const creds = Buffer.from(
          `${process.env.{{envPrefix}}_USER}:${process.env.{{envPrefix}}_PASS}`
        ).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      }
      {{/if}}

      // Substitute path parameters
      let resolvedPath = pathTemplate;
      if (options.pathParams) {
        for (const [key, value] of Object.entries(options.pathParams)) {
          resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
        }
      }

      const url = new URL(resolvedPath, baseUrl);

      // Append query parameters
      if (options.queryParams) {
        for (const [key, value] of Object.entries(options.queryParams)) {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        }
      }

      {{#if (eq auth.type 'api-key')}}
      {{#if (eq auth.location 'query')}}
      if (process.env.{{envPrefix}}_API_KEY) {
        url.searchParams.append('{{auth.name}}', process.env.{{envPrefix}}_API_KEY);
      }
      {{/if}}
      {{/if}}

      const fetchOptions: RequestInit = { method, headers };

      if (options.body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `API error ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`
        );
      }

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  };
}
```

**Step 2: Update `templates/package.json.hbs`**

Remove `"node-fetch": "^3.3.0"` from dependencies. Add engine requirement:
```json
"engines": { "node": ">=18" }
```

**Step 3: Verify MCP Factory itself still builds**

Run: `npm run build`
Expected: Clean compile.

**Step 4: Commit**

```bash
git add templates/client.ts.hbs templates/package.json.hbs
git commit -m "feat: rewrite client template with path/query/body separation and auth"
```

---

## Task 4: Rewrite `tools.ts.hbs` template

Use EndpointContext to generate clean tool definitions with separated param bags.

**Files:**
- Rewrite: `templates/tools.ts.hbs`

**Step 1: Rewrite the template**

Replace `templates/tools.ts.hbs` entirely with:

```handlebars
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { APIClient } from './client.js';

export const tools = [
  {{#each endpoints}}
  {
    name: '{{toolName}}',
    description: '{{{jsString description}}}',
    inputSchema: {
      type: 'object' as const,
      properties: {
        {{#each allParams}}
        '{{name}}': {
          type: '{{type}}',
          {{#if description}}description: '{{{jsString description}}}',{{/if}}
        },
        {{/each}}
      },
      required: [{{#each requiredParams}}'{{this}}',{{/each}}],
    },
  },
  {{/each}}
];

export async function handleToolCall(request: CallToolRequest, client: APIClient) {
  const { name, arguments: args = {} } = request.params;

  {{#each endpoints}}
  if (name === '{{toolName}}') {
    const result = await client.request('{{method}}', '{{pathTemplate}}', {
      {{#if pathParams.length}}
      pathParams: {
        {{#each pathParams}}
        '{{name}}': String(args['{{name}}'] ?? ''),
        {{/each}}
      },
      {{/if}}
      {{#if queryParams.length}}
      queryParams: {
        {{#each queryParams}}
        '{{name}}': args['{{name}}'] != null ? String(args['{{name}}']) : undefined,
        {{/each}}
      },
      {{/if}}
      {{#if hasBody}}
      body: {
        {{#each bodyParams}}
        ...(args['{{name}}'] !== undefined && { '{{name}}': args['{{name}}'] }),
        {{/each}}
        {{#unless bodyParams.length}}
        ...args,
        {{/unless}}
      },
      {{/if}}
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  {{/each}}

  throw new Error(`Unknown tool: ${name}`);
}
```

**Step 2: Verify MCP Factory builds**

Run: `npm run build`
Expected: Clean compile.

**Step 3: Commit**

```bash
git add templates/tools.ts.hbs
git commit -m "feat: rewrite tools template with param separation and clean tool names"
```

---

## Task 5: Wire context-builder into engine.ts

Replace the raw schema pass-through with the context builder.

**Files:**
- Modify: `src/generator/engine.ts`
- Modify: `templates/README.md.hbs`

**Step 1: Update engine.ts**

Replace the entire file. Key changes: import `buildTemplateContext`, remove old `GenerationContext`, remove `test.ts.hbs` generation:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { APISchema, DetectedPatterns } from '../schema/api-schema.js';
import { buildTemplateContext } from './context-builder.js';
import { GenerationError } from '../utils/errors.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('jsString', (str: string) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
});

export async function generateServer(
  schema: APISchema,
  patterns: DetectedPatterns,
  outputDir: string
): Promise<void> {
  const context = buildTemplateContext(schema, patterns, path.resolve(outputDir));

  await fs.mkdir(path.join(outputDir, 'src'), { recursive: true });

  const templateDir = path.join(__dirname, '..', '..', 'templates');

  await generateFile(templateDir, outputDir, 'package.json.hbs', 'package.json', context);
  await generateFile(templateDir, outputDir, 'tsconfig.json.hbs', 'tsconfig.json', context);
  await generateFile(templateDir, outputDir, 'README.md.hbs', 'README.md', context);
  await generateFile(templateDir, outputDir, 'index.ts.hbs', 'src/index.ts', context);
  await generateFile(templateDir, outputDir, 'client.ts.hbs', 'src/client.ts', context);
  await generateFile(templateDir, outputDir, 'tools.ts.hbs', 'src/tools.ts', context);
  await generateFile(templateDir, outputDir, 'types.ts.hbs', 'src/types.ts', context);
  await generateFile(templateDir, outputDir, 'validation.ts.hbs', 'src/validation.ts', context);
}

async function generateFile(
  templateDir: string,
  outputDir: string,
  templateFile: string,
  outputFile: string,
  context: any
): Promise<void> {
  try {
    const templatePath = path.join(templateDir, templateFile);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    const output = template(context);

    const outputPath = path.join(outputDir, outputFile);
    await fs.writeFile(outputPath, output, 'utf-8');
  } catch (error) {
    throw new GenerationError(`Failed to generate ${outputFile}: ${error}`);
  }
}
```

**Step 2: Update `templates/README.md.hbs`**

Replace `{{id}}` with `{{toolName}}` and use `envPrefix` for env var names:

```handlebars
# {{name}} MCP Server

MCP server for the {{name}} API.

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

\`\`\`json
{
  "mcpServers": {
    "{{name}}": {
      "command": "node",
      "args": ["{{absolutePath}}/build/index.js"],
      "env": {
        {{#if (eq auth.type 'api-key')}}
        "{{envPrefix}}_API_KEY": "your-api-key-here"
        {{/if}}
        {{#if (eq auth.type 'bearer')}}
        "{{envPrefix}}_TOKEN": "your-token-here"
        {{/if}}
        {{#if (eq auth.type 'oauth')}}
        "{{envPrefix}}_ACCESS_TOKEN": "your-access-token-here"
        {{/if}}
      }
    }
  }
}
\`\`\`

## Available Tools

{{#each endpoints}}
- **{{toolName}}** — {{description}}
{{/each}}
```

**Step 3: Build and test the full pipeline**

Run:
```bash
npm run build
node dist/cli.js create test-fixtures/weather-api.json -o /tmp/test-task5
cd /tmp/test-task5 && npm install && npm run build
```

Expected: Clean compile of both MCP Factory and generated server. Generated `tools.ts` should have `name: 'get_weather'` and `client.ts` should have `X-API-Key` header.

**Step 4: Commit**

```bash
git add src/generator/engine.ts templates/README.md.hbs
git commit -m "feat: wire context-builder into generation engine"
```

---

## Task 6: Generate real types.ts and validation.ts

Replace the empty stubs with actual TypeScript interfaces and Zod schemas.

**Files:**
- Rewrite: `templates/types.ts.hbs`
- Rewrite: `templates/validation.ts.hbs`

**Step 1: Implement types.ts.hbs**

```handlebars
{{#each endpoints}}
export interface {{toolName}}Params {
  {{#each allParams}}
  {{name}}{{#unless required}}?{{/unless}}: {{#if (eq type 'integer')}}number{{else if (eq type 'number')}}number{{else if (eq type 'boolean')}}boolean{{else if (eq type 'array')}}any[]{{else if (eq type 'object')}}Record<string, any>{{else}}string{{/if}};
  {{/each}}
}

{{/each}}
```

**Step 2: Implement validation.ts.hbs**

```handlebars
import { z } from 'zod';

{{#each endpoints}}
export const {{toolName}}Schema = z.object({
  {{#each allParams}}
  {{name}}: {{#if (eq type 'integer')}}z.number().int(){{else if (eq type 'number')}}z.number(){{else if (eq type 'boolean')}}z.boolean(){{else if (eq type 'array')}}z.array(z.any()){{else if (eq type 'object')}}z.record(z.any()){{else}}z.string(){{/if}}{{#unless required}}.optional(){{/unless}},
  {{/each}}
});

{{/each}}
```

**Step 3: Build and test**

Run:
```bash
npm run build
node dist/cli.js create test-fixtures/weather-api.json -o /tmp/test-task6
cd /tmp/test-task6 && npm install && npm run build
```

Expected: Generated `types.ts` has `export interface get_weatherParams { city: string; }`. Generated `validation.ts` has Zod schema. Both compile.

**Step 4: Commit**

```bash
git add templates/types.ts.hbs templates/validation.ts.hbs
git commit -m "feat: generate real TypeScript types and Zod validation schemas"
```

---

## Task 7: Integration tests

Create tests that exercise the full pipeline.

**Files:**
- Create: `src/tests/integration.test.ts`
- Modify: `package.json` (update test script)

**Step 1: Create the test file**

Create `src/tests/integration.test.ts` with two tests:

1. **Weather fixture test** — generates from weather-api.json, verifies files exist, tool name is `get_weather`, auth header uses `X-API-Key`, query params are separated, then runs `npm install && npm run build` on the output.

2. **Bad operationId test** — creates a synthetic spec with operationIds like `listUsingGET` and `get_3`, generates, verifies the bad names were replaced with derived names like `listUsers`/`getUser`, and verifies requestBody params are included.

Use `node:test` and `node:assert`. Use `fs.mkdtemp` for output dirs. Clean up in `finally` blocks. Use `execFileSync` from `child_process` (not `exec`) for running npm commands safely.

**Step 2: Update package.json test script**

Change test script to: `"test": "node --test dist/tests/**/*.test.js"`

**Step 3: Build and run tests**

Run: `npm run build && npm test`
Expected: 2 tests pass.

**Step 4: Commit**

```bash
git add src/tests/integration.test.ts package.json
git commit -m "test: add integration tests for generate + compile pipeline"
```

---

## Task 8: Fix README.md accuracy

Update the project README to match post-fix reality.

**Files:**
- Modify: `README.md`

**Step 1: Fix specific claims**

- Change the Neon CRM example to show actual tool count (re-run and check)
- Change `✅ **Tests** - Basic smoke tests included` to `✅ **Tests** - Integration tests verify generated output compiles`
- Remove references to `node-fetch` — we now use native fetch
- Verify all feature claims match reality

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: fix README accuracy to match production-grade output"
```

---

## Task 9: Spotify end-to-end demo

Download the Spotify OpenAPI spec, generate a server, and verify it compiles.

**Files:**
- Create: `test-fixtures/spotify-openapi.yaml`

**Step 1: Get the Spotify OpenAPI spec**

Download from Spotify's public API reference. Save to `test-fixtures/spotify-openapi.yaml`.

**Step 2: Generate and compile**

Run:
```bash
npm run build
node dist/cli.js create test-fixtures/spotify-openapi.yaml -o /tmp/spotify-mcp
cd /tmp/spotify-mcp && npm install && npm run build
```

Expected: Clean compile. Tool names like `getTrack`, `searchTracks`. Bearer auth with `SPOTIFY_WEB_API_TOKEN`.

**Step 3: Spot-check output**

Verify tool names, path param substitution, query param separation, auth, types, validation.

**Step 4: Add Spotify snapshot test**

Add a third test to `src/tests/integration.test.ts` that generates from the Spotify fixture and asserts key tool names and auth config.

**Step 5: Commit**

```bash
git add test-fixtures/spotify-openapi.yaml src/tests/integration.test.ts
git commit -m "feat: add Spotify demo fixture and snapshot test"
```

---

## Task 10: Final verification and cleanup

**Step 1: Full build + test**

Run: `npm run build && npm test`
Expected: All tests pass.

**Step 2: Test large spec (Neon CRM)**

Run:
```bash
node dist/cli.js create "Neon CRM API documentation/v2.11.yaml" -o /tmp/neon-final
cd /tmp/neon-final && npm install && npm run build
```

Expected: Clean compile with improved tool names.

**Step 3: Test small spec (weather)**

Run:
```bash
node dist/cli.js create test-fixtures/weather-api.json -o /tmp/weather-final
cd /tmp/weather-final && npm install && npm run build
```

Expected: Clean compile.

**Step 4: Delete stale `templates/test.ts.hbs`**

Remove the placeholder test template.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for production-grade release"
```
