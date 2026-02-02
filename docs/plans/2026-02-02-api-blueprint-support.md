# API Blueprint (.apib) Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add support for parsing API Blueprint (.apib) format files to generate MCP servers, enabling users to use .apib documentation alongside OpenAPI/Swagger specs.

**Architecture:** Extend the existing parser pipeline with a new API Blueprint parser that transforms .apib AST into our unified APISchema format. Use the `protagonist` library for .apib parsing, following the same pattern as existing OpenAPI/Postman parsers.

**Tech Stack:** TypeScript, protagonist (API Blueprint parser), existing MCP Factory architecture

---

## Task 1: Add protagonist dependency and type definitions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

**Step 1: Add protagonist npm package**

Run:
```bash
npm install protagonist
```

Expected: Package added to dependencies, package-lock.json updated

**Step 2: Add TypeScript types for protagonist**

Run:
```bash
npm install --save-dev @types/protagonist
```

Expected: Types added to devDependencies

Note: If @types/protagonist doesn't exist, we'll declare types inline in the parser file.

**Step 3: Commit dependency changes**

```bash
git add package.json package-lock.json
git commit -m "chore: add protagonist for API Blueprint parsing"
```

---

## Task 2: Update format detector to recognize .apib files

**Files:**
- Modify: `src/parsers/detector.ts`

**Step 1: Write failing test for .apib detection**

Create: `src/parsers/detector.test.ts`

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectFormat } from './detector.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Format Detector', () => {
  it('should detect API Blueprint format from .apib file', async () => {
    // Create temp .apib file
    const tempFile = path.join(process.cwd(), 'test.apib');
    await fs.writeFile(tempFile, 'FORMAT: 1A\n# My API\n## GET /users', 'utf-8');

    try {
      const result = await detectFormat(tempFile);
      assert.strictEqual(result.format, 'apib');
      assert.ok(result.content.includes('FORMAT: 1A'));
    } finally {
      await fs.unlink(tempFile);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run build && node --test dist/parsers/detector.test.js
```

Expected: FAIL - format should be 'apib' but got 'unknown'

**Step 3: Update detector.ts to add apib format type**

Modify: `src/parsers/detector.ts`

```typescript
export type InputFormat = 'openapi' | 'swagger' | 'postman' | 'apib' | 'unknown';
```

**Step 4: Update detector.ts to check for .apib extension**

Modify: `src/parsers/detector.ts` in the `detectFormat` function, add before JSON/YAML parsing:

```typescript
export async function detectFormat(input: string): Promise<DetectionResult> {
  let content: string;

  // Check if input is a file path
  try {
    content = await fs.readFile(input, 'utf-8');
  } catch {
    throw new ParseError(`Could not read file: ${input}`);
  }

  // Check file extension for API Blueprint
  if (input.endsWith('.apib') || input.endsWith('.apiblueprint')) {
    return { format: 'apib', content };
  }

  // Alternatively, check content for API Blueprint markers
  if (content.trim().startsWith('FORMAT: 1A')) {
    return { format: 'apib', content };
  }

  // Rest of existing JSON/YAML parsing...
```

**Step 5: Run test to verify it passes**

Run:
```bash
npm run build && node --test dist/parsers/detector.test.js
```

Expected: PASS - .apib files detected correctly

**Step 6: Commit detector changes**

```bash
git add src/parsers/detector.ts src/parsers/detector.test.ts
git commit -m "feat: detect API Blueprint (.apib) format"
```

---

## Task 3: Create API Blueprint parser

**Files:**
- Create: `src/parsers/apib-parser.ts`
- Create: `src/parsers/apib-parser.test.ts`

**Step 1: Write failing test for API Blueprint parsing**

Create: `src/parsers/apib-parser.test.ts`

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseAPIBlueprint } from './apib-parser.js';

describe('API Blueprint Parser', () => {
  it('should parse a basic API Blueprint document', async () => {
    const apibContent = `
FORMAT: 1A
HOST: https://api.example.com

# My API
This is my API description.

## GET /users
Get a list of users

+ Response 200 (application/json)
    + Body

            [
              {
                "id": 1,
                "name": "John Doe"
              }
            ]

## POST /users
Create a new user

+ Request (application/json)
    + Body

            {
              "name": "John Doe"
            }

+ Response 201 (application/json)
    + Body

            {
              "id": 1,
              "name": "John Doe"
            }
`;

    const schema = await parseAPIBlueprint(apibContent);

    assert.strictEqual(schema.name, 'My API');
    assert.strictEqual(schema.baseUrl, 'https://api.example.com');
    assert.strictEqual(schema.endpoints.length, 2);

    // Check GET endpoint
    const getEndpoint = schema.endpoints.find(e => e.method === 'GET');
    assert.ok(getEndpoint);
    assert.strictEqual(getEndpoint.path, '/users');
    assert.strictEqual(getEndpoint.description, 'Get a list of users');

    // Check POST endpoint
    const postEndpoint = schema.endpoints.find(e => e.method === 'POST');
    assert.ok(postEndpoint);
    assert.strictEqual(postEndpoint.path, '/users');
    assert.strictEqual(postEndpoint.description, 'Create a new user');
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm run build && node --test dist/parsers/apib-parser.test.js
```

Expected: FAIL - parseAPIBlueprint is not defined

**Step 3: Create minimal API Blueprint parser implementation**

Create: `src/parsers/apib-parser.ts`

```typescript
import protagonist from 'protagonist';
import { APISchema, Endpoint, AuthConfig, Parameter, ResponseSchema, ErrorSchema, SchemaType, RequestBody } from '../schema/api-schema.js';

export async function parseAPIBlueprint(content: string): Promise<APISchema> {
  // Parse the API Blueprint content
  const result = await protagonist.parse(content);

  if (result.error) {
    throw new Error(`API Blueprint parse error: ${result.error.message}`);
  }

  const ast = result.ast;

  // Extract API name and description
  const name = ast.name || 'Untitled API';
  const baseUrl = extractBaseUrl(ast);

  // Extract endpoints from resource groups
  const endpoints: Endpoint[] = [];

  for (const resourceGroup of ast.resourceGroups || []) {
    for (const resource of resourceGroup.resources || []) {
      for (const action of resource.actions || []) {
        const endpoint = parseAction(resource, action);
        endpoints.push(endpoint);
      }
    }
  }

  // Detect authentication (basic heuristic)
  const auth: AuthConfig = detectAuth(ast);

  return {
    name,
    baseUrl,
    auth,
    endpoints,
    commonHeaders: {},
  };
}

function extractBaseUrl(ast: any): string {
  // Check metadata for HOST
  if (ast.metadata) {
    for (const meta of ast.metadata) {
      if (meta.name === 'HOST') {
        return meta.value;
      }
    }
  }
  return '';
}

function parseAction(resource: any, action: any): Endpoint {
  const method = action.method.toUpperCase() as Endpoint['method'];
  const path = resource.uriTemplate;
  const description = action.description || action.name || '';

  // Extract parameters from URI template and action parameters
  const parameters: Parameter[] = parseParameters(resource, action);

  // Extract request body if present
  const requestBody = parseRequestBody(action);

  // Extract response schema
  const response = parseResponse(action);

  // Extract error responses
  const errors = parseErrors(action);

  return {
    id: `${method.toLowerCase()}${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    method,
    path,
    description,
    parameters,
    requestBody,
    response,
    errors,
  };
}

function parseParameters(resource: any, action: any): Parameter[] {
  const parameters: Parameter[] = [];

  // Parse URI parameters
  if (resource.parameters) {
    for (const param of resource.parameters) {
      parameters.push({
        name: param.name,
        in: 'path',
        description: param.description || '',
        required: param.required || false,
        schema: {
          type: mapTypeToSchemaType(param.type),
        },
      });
    }
  }

  // Parse action parameters (usually query/header)
  if (action.parameters) {
    for (const param of action.parameters) {
      parameters.push({
        name: param.name,
        in: 'query', // Default to query, could be enhanced
        description: param.description || '',
        required: param.required || false,
        schema: {
          type: mapTypeToSchemaType(param.type),
        },
      });
    }
  }

  return parameters;
}

function parseRequestBody(action: any): RequestBody | undefined {
  // Find request with a body
  const request = action.examples?.[0]?.requests?.[0];
  if (!request || !request.body) {
    return undefined;
  }

  return {
    description: request.description || '',
    required: true,
    contentType: request.headers?.['Content-Type']?.[0]?.value || 'application/json',
    schema: {
      type: 'object', // Simplified - could parse JSON schema from body
    },
  };
}

function parseResponse(action: any): ResponseSchema {
  // Get first successful response (200-299)
  const response = action.examples?.[0]?.responses?.[0];

  if (!response) {
    return {
      statusCode: 200,
      description: '',
      contentType: 'application/json',
      schema: { type: 'object' },
    };
  }

  return {
    statusCode: parseInt(response.name) || 200,
    description: response.description || '',
    contentType: response.headers?.['Content-Type']?.[0]?.value || 'application/json',
    schema: {
      type: 'object', // Simplified - could parse JSON schema from body
    },
  };
}

function parseErrors(action: any): ErrorSchema[] {
  const errors: ErrorSchema[] = [];

  const responses = action.examples?.[0]?.responses || [];
  for (const response of responses) {
    const statusCode = parseInt(response.name);
    if (statusCode >= 400) {
      errors.push({
        statusCode,
        description: response.description || `Error ${statusCode}`,
      });
    }
  }

  return errors;
}

function detectAuth(ast: any): AuthConfig {
  // Simple heuristic: check if any examples mention authentication
  const astString = JSON.stringify(ast).toLowerCase();

  if (astString.includes('bearer') || astString.includes('jwt')) {
    return {
      type: 'bearer',
      location: 'header',
      name: 'Authorization',
      description: 'Bearer token authentication',
    };
  }

  if (astString.includes('api-key') || astString.includes('apikey')) {
    return {
      type: 'api-key',
      location: 'header',
      name: 'X-API-Key',
      description: 'API key authentication',
    };
  }

  return {
    type: 'none',
  };
}

function mapTypeToSchemaType(type?: string): SchemaType['type'] {
  if (!type) return 'string';

  const lowerType = type.toLowerCase();
  if (lowerType.includes('number') || lowerType.includes('integer')) return 'number';
  if (lowerType.includes('bool')) return 'boolean';
  if (lowerType.includes('array')) return 'array';
  if (lowerType.includes('object')) return 'object';

  return 'string';
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
npm run build && node --test dist/parsers/apib-parser.test.js
```

Expected: PASS - API Blueprint parsed correctly into APISchema

**Step 5: Commit API Blueprint parser**

```bash
git add src/parsers/apib-parser.ts src/parsers/apib-parser.test.ts
git commit -m "feat: implement API Blueprint parser"
```

---

## Task 4: Wire up API Blueprint parser in create command

**Files:**
- Modify: `src/commands/create.ts`

**Step 1: Write integration test**

Create: `test-fixtures/sample.apib`

```apib
FORMAT: 1A
HOST: https://api.example.com

# Sample API
A simple API for testing

## Users Collection [/users]

### List Users [GET]
Get a list of all users

+ Response 200 (application/json)
    + Body

            [
              {"id": 1, "name": "Alice"},
              {"id": 2, "name": "Bob"}
            ]

### Create User [POST]
Create a new user

+ Request (application/json)
    + Body

            {"name": "Charlie"}

+ Response 201 (application/json)
    + Body

            {"id": 3, "name": "Charlie"}
```

**Step 2: Test manually to verify it fails**

Run:
```bash
npm run build
node dist/cli.js create test-fixtures/sample.apib
```

Expected: Error - "Could not detect format" or similar

**Step 3: Import API Blueprint parser in create command**

Modify: `src/commands/create.ts`

Add import at top:
```typescript
import { parseAPIBlueprint } from '../parsers/apib-parser.js';
```

**Step 4: Add API Blueprint case to parser switch**

Modify: `src/commands/create.ts` in the `createCommand` function:

```typescript
    // Parse to APISchema
    let schema;
    if (detection.format === 'openapi' || detection.format === 'swagger') {
      schema = parseOpenAPI(detection.content);
    } else if (detection.format === 'postman') {
      schema = parsePostman(detection.content);
    } else if (detection.format === 'apib') {
      schema = await parseAPIBlueprint(detection.content);
    } else if (options.aiParse) {
      logger.info('Using AI parser for unstructured docs...');
      schema = await parseWithAI(JSON.stringify(detection.content));
    } else {
      throw new ParseError('Could not detect format. Use --ai-parse for unstructured docs.');
    }
```

**Step 5: Test integration manually**

Run:
```bash
npm run build
node dist/cli.js create test-fixtures/sample.apib
```

Expected: Success - MCP server generated from .apib file

**Step 6: Verify generated server builds and runs**

Run:
```bash
cd "Sample API-mcp"
npm install
npm run build
npm test
```

Expected: All commands succeed

**Step 7: Commit integration**

```bash
git add src/commands/create.ts test-fixtures/sample.apib
git commit -m "feat: integrate API Blueprint parser into create command"
```

---

## Task 5: Update documentation

**Files:**
- Modify: `README.md`

**Step 1: Update supported formats section**

Modify: `README.md`

Find the "Supported Formats" section and update:

```markdown
**Supported Formats:**
- OpenAPI 3.x (JSON/YAML)
- Swagger 2.0 (JSON/YAML)
- API Blueprint (.apib)
- Postman Collections (coming soon)
- Unstructured docs with `--ai-parse` (coming soon)
```

**Step 2: Add API Blueprint example**

Add to examples section:

```markdown
### Example: API Blueprint

```bash
# Generate from API Blueprint file
mcp-factory create ./api-documentation.apib

cd "My API-mcp"
npm install && npm run build
mcp-factory install "My API"
```
```

**Step 3: Update quick start if needed**

Ensure quick start mentions .apib support:

```markdown
## Quick Start

```bash
# Generate MCP server from API documentation
# Supports: OpenAPI, Swagger, API Blueprint (.apib)
mcp-factory create ./api-docs.yaml

# Build the generated server
cd "My API-mcp"
npm install && npm run build

# Install to Claude Desktop
mcp-factory install "My API"
```
```

**Step 4: Commit documentation updates**

```bash
git add README.md
git commit -m "docs: add API Blueprint format support to README"
```

---

## Task 6: Version bump and publish preparation

**Files:**
- Modify: `package.json`

**Step 1: Run all tests to verify everything works**

Run:
```bash
npm run build
npm test
```

Expected: All tests pass

**Step 2: Test with real .apib file if available**

If user has a real .apib file:
```bash
node dist/cli.js create /path/to/real-api.apib
```

Verify it generates correctly.

**Step 3: Bump version**

Run:
```bash
npm version minor -m "feat: add API Blueprint (.apib) format support"
```

Expected: Version bumped from 0.1.2 to 0.2.0 (minor version for new feature)

**Step 4: Push changes and tag**

```bash
git push
git push --tags
```

**Step 5: Publish to npm**

```bash
npm publish --access public
```

Expected: Package published successfully

**Step 6: Verify installation**

```bash
npm install -g @stackkedjohn/mcp-factory-cli
mcp-factory --version
```

Expected: Shows new version 0.2.0

---

## Testing Checklist

After implementation, verify:

- [ ] .apib files are detected correctly by format detector
- [ ] API Blueprint parser extracts API name, base URL, and endpoints
- [ ] Generated MCP server from .apib builds without errors
- [ ] Generated server includes all endpoints from .apib
- [ ] Authentication is detected (at least basic heuristics)
- [ ] Parameters (path/query) are extracted correctly
- [ ] Request/response bodies are handled
- [ ] Error responses (4xx/5xx) are captured
- [ ] Generated server can be installed to Claude Desktop
- [ ] README accurately documents .apib support
- [ ] npm package published with new version

---

## Notes for Implementation

**Key Libraries:**
- `protagonist` - Official API Blueprint parser (Node.js wrapper around Drafter C++ library)
- AST structure follows API Blueprint spec

**Known Limitations:**
- Schema inference from example bodies is simplified (uses generic 'object' type)
- Authentication detection uses heuristics (not explicit .apib auth declarations)
- Could enhance with JSON Schema parsing from MSON attributes

**Future Enhancements:**
- Parse MSON (Markdown Syntax for Object Notation) for detailed schemas
- Better authentication parsing from Headers section
- Support for Data Structures section
- Validation against API Blueprint spec

**Protagonist AST Structure:**
```typescript
{
  ast: {
    name: string;
    description: string;
    metadata: Array<{name: string, value: string}>;
    resourceGroups: Array<{
      name: string;
      resources: Array<{
        name: string;
        uriTemplate: string;
        parameters: Array<Parameter>;
        actions: Array<{
          name: string;
          method: string;
          description: string;
          examples: Array<{
            requests: Array<{body: string, headers: any}>;
            responses: Array<{name: string, body: string, headers: any}>;
          }>;
        }>;
      }>;
    }>;
  };
}
```

---

## Execution Complete

After all tasks completed:

1. Merge feature branch to main
2. Verify npm package published
3. Test global installation: `npm i -g @stackkedjohn/mcp-factory-cli`
4. Test with real .apib file from user
5. Update project documentation with new feature announcement
