# MCP Factory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool that generates production-ready MCP servers from API documentation in one command.

**Architecture:** Three-stage pipeline (input processing → normalization → code generation) with template-based generation, smart format detection, and optional AI parsing for unstructured docs.

**Tech Stack:** TypeScript, Commander.js, Handlebars, Zod, Anthropic SDK, openapi-typescript

---

## Phase 1: Project Foundation

### Task 1: Initialize Project Structure

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/cli.ts`

**Step 1: Initialize npm package**

Run: `npm init -y`
Expected: Creates package.json

**Step 2: Update package.json**

```json
{
  "name": "@mcp-factory/cli",
  "version": "0.1.0",
  "description": "Generate production-ready MCP servers from API documentation",
  "main": "dist/cli.js",
  "bin": {
    "mcp-factory": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "node --test dist/**/*.test.js"
  },
  "keywords": ["mcp", "api", "codegen", "cli"],
  "author": "",
  "license": "MIT"
}
```

**Step 3: Install dependencies**

Run: `npm install commander handlebars zod @anthropic-ai/sdk yaml`
Run: `npm install -D typescript @types/node tsx`

Expected: All packages installed

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create basic CLI entry point**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('mcp-factory')
  .description('Generate production-ready MCP servers from API documentation')
  .version('0.1.0');

program.parse();
```

**Step 6: Test CLI runs**

Run: `npm run build && node dist/cli.js --version`
Expected: Outputs "0.1.0"

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/cli.ts
git commit -m "feat: initialize MCP Factory CLI project

Set up TypeScript project with Commander.js for CLI framework.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Core Schema and Utilities

### Task 2: Define APISchema Types

**Files:**
- Create: `src/schema/api-schema.ts`

**Step 1: Create schema type definitions**

```typescript
export interface APISchema {
  name: string;
  baseUrl: string;
  auth: AuthConfig;
  endpoints: Endpoint[];
  commonHeaders?: Record<string, string>;
  rateLimit?: RateLimitConfig;
  pagination?: PaginationConfig;
}

export interface AuthConfig {
  type: 'api-key' | 'bearer' | 'oauth' | 'basic' | 'none';
  location?: 'header' | 'query';
  name?: string;
  description?: string;
}

export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  response: ResponseSchema;
  errors: ErrorSchema[];
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  description?: string;
  required: boolean;
  schema: SchemaType;
}

export interface RequestBody {
  description?: string;
  required: boolean;
  contentType: string;
  schema: SchemaType;
}

export interface ResponseSchema {
  statusCode: number;
  description?: string;
  contentType: string;
  schema: SchemaType;
}

export interface ErrorSchema {
  statusCode: number;
  description: string;
  schema?: SchemaType;
}

export interface SchemaType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  properties?: Record<string, SchemaType>;
  items?: SchemaType;
  required?: string[];
  enum?: string[];
  format?: string;
}

export interface RateLimitConfig {
  strategy: 'header-based' | 'retry-after' | 'none';
  headerName?: string;
  requestsPerWindow?: number;
  windowSeconds?: number;
}

export interface PaginationConfig {
  style: 'cursor' | 'offset' | 'page' | 'link-header';
  cursorParam?: string;
  limitParam?: string;
  offsetParam?: string;
  pageParam?: string;
}

export interface DetectedPatterns {
  authPattern: 'api-key' | 'bearer' | 'oauth' | 'basic' | 'none';
  paginationStyle?: 'cursor' | 'offset' | 'page' | 'link-header';
  rateLimitStrategy?: 'header-based' | 'retry-after' | 'none';
  errorFormat: 'standard' | 'custom';
  hasWebhooks: boolean;
}
```

**Step 2: Build to verify types are valid**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/schema/api-schema.ts
git commit -m "feat: define unified APISchema type definitions

Core types for normalized API representation used across all parsers.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Create Utility Modules

**Files:**
- Create: `src/utils/errors.ts`
- Create: `src/utils/logger.ts`

**Step 1: Create error utilities**

```typescript
export class MCPFactoryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MCPFactoryError';
  }
}

export class ParseError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}

export class ValidationError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class GenerationError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'GENERATION_ERROR');
    this.name = 'GenerationError';
  }
}
```

**Step 2: Create logger utility**

```typescript
export const logger = {
  info: (message: string) => {
    console.log(`ℹ ${message}`);
  },

  success: (message: string) => {
    console.log(`✓ ${message}`);
  },

  error: (message: string) => {
    console.error(`✗ ${message}`);
  },

  warn: (message: string) => {
    console.warn(`⚠ ${message}`);
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`);
    }
  }
};
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: add error handling and logging utilities

Custom error types and logger for CLI output.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Input Processing

### Task 4: Implement Format Detector

**Files:**
- Create: `src/parsers/detector.ts`

**Step 1: Create format detector**

```typescript
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import { ParseError } from '../utils/errors.js';

export type InputFormat = 'openapi' | 'swagger' | 'postman' | 'unknown';

export interface DetectionResult {
  format: InputFormat;
  content: any;
}

export async function detectFormat(input: string): Promise<DetectionResult> {
  let content: string;

  // Check if input is a file path
  try {
    content = await fs.readFile(input, 'utf-8');
  } catch {
    throw new ParseError(`Could not read file: ${input}`);
  }

  // Try parsing as JSON
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try parsing as YAML
    try {
      parsed = yaml.parse(content);
    } catch {
      throw new ParseError('Could not parse input as JSON or YAML');
    }
  }

  // Detect format from parsed content
  if (parsed.openapi) {
    return { format: 'openapi', content: parsed };
  }

  if (parsed.swagger) {
    return { format: 'swagger', content: parsed };
  }

  if (parsed.info?.schema?.includes('postman')) {
    return { format: 'postman', content: parsed };
  }

  return { format: 'unknown', content: parsed };
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/parsers/detector.ts
git commit -m "feat: implement format detection for API specs

Auto-detect OpenAPI, Swagger, and Postman collection formats.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Implement OpenAPI Parser

**Files:**
- Create: `src/parsers/openapi.ts`

**Step 1: Create OpenAPI parser**

```typescript
import { APISchema, Endpoint, Parameter, AuthConfig, SchemaType } from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

export function parseOpenAPI(spec: any): APISchema {
  if (!spec.openapi && !spec.swagger) {
    throw new ParseError('Invalid OpenAPI/Swagger specification');
  }

  const name = spec.info?.title?.toLowerCase().replace(/\s+/g, '-') || 'api';
  const baseUrl = getBaseUrl(spec);
  const auth = detectAuth(spec);
  const endpoints = parseEndpoints(spec);

  return {
    name,
    baseUrl,
    auth,
    endpoints,
  };
}

function getBaseUrl(spec: any): string {
  // OpenAPI 3.x
  if (spec.servers && spec.servers.length > 0) {
    return spec.servers[0].url;
  }

  // Swagger 2.0
  if (spec.host) {
    const scheme = spec.schemes?.[0] || 'https';
    const basePath = spec.basePath || '';
    return `${scheme}://${spec.host}${basePath}`;
  }

  throw new ParseError('Could not determine base URL from specification');
}

function detectAuth(spec: any): AuthConfig {
  // OpenAPI 3.x
  if (spec.components?.securitySchemes) {
    const schemes = spec.components.securitySchemes;
    const firstScheme = Object.values(schemes)[0] as any;

    if (firstScheme.type === 'apiKey') {
      return {
        type: 'api-key',
        location: firstScheme.in,
        name: firstScheme.name,
        description: firstScheme.description,
      };
    }

    if (firstScheme.type === 'http' && firstScheme.scheme === 'bearer') {
      return {
        type: 'bearer',
        location: 'header',
        name: 'Authorization',
      };
    }

    if (firstScheme.type === 'oauth2') {
      return {
        type: 'oauth',
        description: firstScheme.description,
      };
    }
  }

  // Swagger 2.0
  if (spec.securityDefinitions) {
    const firstScheme = Object.values(spec.securityDefinitions)[0] as any;

    if (firstScheme.type === 'apiKey') {
      return {
        type: 'api-key',
        location: firstScheme.in,
        name: firstScheme.name,
      };
    }
  }

  return { type: 'none' };
}

function parseEndpoints(spec: any): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods as any)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        endpoints.push(parseOperation(path, method, operation));
      }
    }
  }

  return endpoints;
}

function parseOperation(path: string, method: string, operation: any): Endpoint {
  const id = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const description = operation.summary || operation.description || `${method.toUpperCase()} ${path}`;
  const parameters = parseParameters(operation.parameters || []);

  return {
    id,
    method: method.toUpperCase() as any,
    path,
    description,
    parameters,
    response: {
      statusCode: 200,
      description: 'Successful response',
      contentType: 'application/json',
      schema: { type: 'object' },
    },
    errors: [],
  };
}

function parseParameters(params: any[]): Parameter[] {
  return params.map(param => ({
    name: param.name,
    in: param.in,
    description: param.description,
    required: param.required || false,
    schema: parseSchema(param.schema || { type: param.type || 'string' }),
  }));
}

function parseSchema(schema: any): SchemaType {
  return {
    type: schema.type || 'string',
    properties: schema.properties,
    items: schema.items ? parseSchema(schema.items) : undefined,
    required: schema.required,
    enum: schema.enum,
    format: schema.format,
  };
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/parsers/openapi.ts
git commit -m "feat: implement OpenAPI/Swagger parser

Parse OpenAPI 3.x and Swagger 2.0 specs into unified APISchema.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Implement Postman Parser (Stub)

**Files:**
- Create: `src/parsers/postman.ts`

**Step 1: Create stub Postman parser**

```typescript
import { APISchema } from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

export function parsePostman(collection: any): APISchema {
  throw new ParseError('Postman collection parsing not yet implemented');
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/parsers/postman.ts
git commit -m "feat: add Postman parser stub

Placeholder for future Postman collection support.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Implement AI Parser (Stub)

**Files:**
- Create: `src/parsers/ai-parser.ts`

**Step 1: Create stub AI parser**

```typescript
import { APISchema } from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

export async function parseWithAI(content: string): Promise<APISchema> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ParseError('ANTHROPIC_API_KEY environment variable required for AI parsing');
  }

  throw new ParseError('AI-powered parsing not yet implemented');
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/parsers/ai-parser.ts
git commit -m "feat: add AI parser stub

Placeholder for Claude API-powered parsing of unstructured docs.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Code Generation

### Task 8: Implement Pattern Analyzer

**Files:**
- Create: `src/generator/analyzer.ts`

**Step 1: Create pattern analyzer**

```typescript
import { APISchema, DetectedPatterns } from '../schema/api-schema.js';

export function analyzePatterns(schema: APISchema): DetectedPatterns {
  return {
    authPattern: schema.auth.type,
    paginationStyle: schema.pagination?.style,
    rateLimitStrategy: schema.rateLimit?.strategy || 'none',
    errorFormat: detectErrorFormat(schema),
    hasWebhooks: false,
  };
}

function detectErrorFormat(schema: APISchema): 'standard' | 'custom' {
  // Check if any endpoint has custom error schemas
  const hasCustomErrors = schema.endpoints.some(
    endpoint => endpoint.errors.length > 0 && endpoint.errors.some(e => e.schema)
  );

  return hasCustomErrors ? 'custom' : 'standard';
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/generator/analyzer.ts
git commit -m "feat: implement pattern detection analyzer

Analyze APISchema to detect auth, pagination, rate limiting patterns.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Create Template Files

**Files:**
- Create: `templates/package.json.hbs`
- Create: `templates/tsconfig.json.hbs`
- Create: `templates/README.md.hbs`
- Create: `templates/index.ts.hbs`
- Create: `templates/client.ts.hbs`
- Create: `templates/tools.ts.hbs`
- Create: `templates/types.ts.hbs`
- Create: `templates/validation.ts.hbs`
- Create: `templates/test.ts.hbs`

**Step 1: Create package.json template**

```handlebars
{
  "name": "{{name}}-mcp",
  "version": "1.0.0",
  "description": "MCP server for {{name}} API",
  "type": "module",
  "main": "build/index.js",
  "scripts": {
    "build": "tsc",
    "test": "node --test test.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create tsconfig.json template**

```handlebars
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create README template**

```handlebars
# {{name}} MCP Server

MCP server for the {{name}} API.

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "{{name}}": {
      "command": "node",
      "args": ["{{absolutePath}}/build/index.js"],
      "env": {
        {{#if (eq patterns.authPattern 'api-key')}}
        "API_KEY": "your-api-key-here"
        {{/if}}
        {{#if (eq patterns.authPattern 'bearer')}}
        "BEARER_TOKEN": "your-bearer-token-here"
        {{/if}}
      }
    }
  }
}
```

## Usage

Available tools:
{{#each endpoints}}
- `{{id}}`: {{description}}
{{/each}}
```

**Step 4: Create minimal index.ts template**

```handlebars
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from './client.js';
import { tools, handleToolCall } from './tools.js';

const server = new Server(
  {
    name: '{{name}}-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const client = createClient('{{baseUrl}}');

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) =>
  handleToolCall(request, client)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

**Step 5: Create client.ts template**

```handlebars
import fetch from 'node-fetch';

export interface APIClient {
  baseUrl: string;
  request: (method: string, path: string, params?: any) => Promise<any>;
}

export function createClient(baseUrl: string): APIClient {
  return {
    baseUrl,
    async request(method: string, path: string, params?: any) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      {{#if (eq patterns.authPattern 'api-key')}}
      if (process.env.API_KEY) {
        {{#if (eq auth.location 'header')}}
        headers['{{auth.name}}'] = process.env.API_KEY;
        {{/if}}
      }
      {{/if}}

      {{#if (eq patterns.authPattern 'bearer')}}
      if (process.env.BEARER_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.BEARER_TOKEN}`;
      }
      {{/if}}

      const url = new URL(path, baseUrl);

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: params ? JSON.stringify(params) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json();
    },
  };
}
```

**Step 6: Create tools.ts template**

```handlebars
import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { APIClient } from './client.js';

export const tools = [
  {{#each endpoints}}
  {
    name: '{{id}}',
    description: '{{description}}',
    inputSchema: {
      type: 'object',
      properties: {
        {{#each parameters}}
        {{name}}: {
          type: '{{schema.type}}',
          {{#if description}}description: '{{description}}',{{/if}}
        },
        {{/each}}
      },
      required: [{{#each parameters}}{{#if required}}'{{name}}',{{/if}}{{/each}}],
    },
  },
  {{/each}}
];

export async function handleToolCall(request: CallToolRequest, client: APIClient) {
  const { name, arguments: args } = request.params;

  {{#each endpoints}}
  if (name === '{{id}}') {
    const result = await client.request('{{method}}', '{{path}}', args);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
  {{/each}}

  throw new Error(`Unknown tool: ${name}`);
}
```

**Step 7: Create stub templates for types, validation, test**

Create empty/minimal templates:
- `templates/types.ts.hbs`: `export {}; // Types generated from API schema`
- `templates/validation.ts.hbs`: `export {}; // Validation schemas`
- `templates/test.ts.hbs`: `console.log('Tests not yet implemented');`

**Step 8: Commit**

```bash
git add templates/
git commit -m "feat: add Handlebars templates for MCP server generation

Core templates for package.json, tsconfig, index, client, tools, README.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Implement Template Engine

**Files:**
- Create: `src/generator/engine.ts`

**Step 1: Create template engine**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { APISchema, DetectedPatterns } from '../schema/api-schema.js';
import { GenerationError } from '../utils/errors.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register Handlebars helper for equality check
Handlebars.registerHelper('eq', (a, b) => a === b);

export interface GenerationContext {
  name: string;
  baseUrl: string;
  auth: any;
  endpoints: any[];
  patterns: DetectedPatterns;
  absolutePath?: string;
}

export async function generateServer(
  schema: APISchema,
  patterns: DetectedPatterns,
  outputDir: string
): Promise<void> {
  const context: GenerationContext = {
    name: schema.name,
    baseUrl: schema.baseUrl,
    auth: schema.auth,
    endpoints: schema.endpoints,
    patterns,
    absolutePath: path.resolve(outputDir),
  };

  // Create output directory structure
  await fs.mkdir(path.join(outputDir, 'src'), { recursive: true });

  // Get template directory
  const templateDir = path.join(__dirname, '..', '..', 'templates');

  // Generate files from templates
  await generateFile(templateDir, outputDir, 'package.json.hbs', 'package.json', context);
  await generateFile(templateDir, outputDir, 'tsconfig.json.hbs', 'tsconfig.json', context);
  await generateFile(templateDir, outputDir, 'README.md.hbs', 'README.md', context);
  await generateFile(templateDir, outputDir, 'index.ts.hbs', 'src/index.ts', context);
  await generateFile(templateDir, outputDir, 'client.ts.hbs', 'src/client.ts', context);
  await generateFile(templateDir, outputDir, 'tools.ts.hbs', 'src/tools.ts', context);
  await generateFile(templateDir, outputDir, 'types.ts.hbs', 'src/types.ts', context);
  await generateFile(templateDir, outputDir, 'validation.ts.hbs', 'src/validation.ts', context);
  await generateFile(templateDir, outputDir, 'test.ts.hbs', 'test.ts', context);
}

async function generateFile(
  templateDir: string,
  outputDir: string,
  templateFile: string,
  outputFile: string,
  context: GenerationContext
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

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/generator/engine.ts
git commit -m "feat: implement Handlebars template engine

Generate MCP server files from templates using APISchema context.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Registry Management

### Task 11: Implement Registry Manager

**Files:**
- Create: `src/registry/manager.ts`

**Step 1: Create registry manager**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface RegistryEntry {
  name: string;
  path: string;
  createdAt: string;
}

export interface Registry {
  servers: RegistryEntry[];
}

const REGISTRY_DIR = path.join(os.homedir(), '.mcp-factory');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

async function ensureRegistry(): Promise<void> {
  try {
    await fs.access(REGISTRY_FILE);
  } catch {
    await fs.mkdir(REGISTRY_DIR, { recursive: true });
    await fs.writeFile(REGISTRY_FILE, JSON.stringify({ servers: [] }, null, 2));
  }
}

export async function loadRegistry(): Promise<Registry> {
  await ensureRegistry();
  const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
  return JSON.parse(content);
}

export async function saveRegistry(registry: Registry): Promise<void> {
  await ensureRegistry();
  await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

export async function addServer(name: string, serverPath: string): Promise<void> {
  const registry = await loadRegistry();

  // Remove existing entry if present
  registry.servers = registry.servers.filter(s => s.name !== name);

  // Add new entry
  registry.servers.push({
    name,
    path: path.resolve(serverPath),
    createdAt: new Date().toISOString(),
  });

  await saveRegistry(registry);
}

export async function getServer(name: string): Promise<RegistryEntry | undefined> {
  const registry = await loadRegistry();
  return registry.servers.find(s => s.name === name);
}

export async function listServers(): Promise<RegistryEntry[]> {
  const registry = await loadRegistry();
  return registry.servers;
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/registry/manager.ts
git commit -m "feat: implement registry manager for tracking generated servers

Manage ~/.mcp-factory/registry.json for listing and installing servers.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 6: CLI Commands

### Task 12: Implement Create Command

**Files:**
- Create: `src/commands/create.ts`

**Step 1: Create command implementation**

```typescript
import * as path from 'path';
import { detectFormat } from '../parsers/detector.js';
import { parseOpenAPI } from '../parsers/openapi.js';
import { parsePostman } from '../parsers/postman.js';
import { parseWithAI } from '../parsers/ai-parser.js';
import { analyzePatterns } from '../generator/analyzer.js';
import { generateServer } from '../generator/engine.js';
import { addServer } from '../registry/manager.js';
import { logger } from '../utils/logger.js';
import { ParseError } from '../utils/errors.js';

export async function createCommand(
  input: string,
  options: { aiParse?: boolean; output?: string }
): Promise<void> {
  try {
    logger.info(`Detecting format for: ${input}`);

    // Detect format
    const detection = await detectFormat(input);
    logger.info(`Detected format: ${detection.format}`);

    // Parse to APISchema
    let schema;
    if (detection.format === 'openapi' || detection.format === 'swagger') {
      schema = parseOpenAPI(detection.content);
    } else if (detection.format === 'postman') {
      schema = parsePostman(detection.content);
    } else if (options.aiParse) {
      logger.info('Using AI parser for unstructured docs...');
      schema = await parseWithAI(JSON.stringify(detection.content));
    } else {
      throw new ParseError('Could not detect format. Use --ai-parse for unstructured docs.');
    }

    logger.success(`Parsed API: ${schema.name}`);

    // Analyze patterns
    const patterns = analyzePatterns(schema);
    logger.info(`Detected patterns: auth=${patterns.authPattern}, pagination=${patterns.paginationStyle || 'none'}`);

    // Generate server
    const outputDir = options.output || path.join(process.cwd(), `${schema.name}-mcp`);
    logger.info(`Generating server in: ${outputDir}`);

    await generateServer(schema, patterns, outputDir);

    // Add to registry
    await addServer(schema.name, outputDir);

    logger.success(`Generated MCP server: ${schema.name}`);
    logger.info(`Next steps:`);
    logger.info(`  cd ${outputDir}`);
    logger.info(`  npm install`);
    logger.info(`  npm run build`);
    logger.info(`  npm test`);

  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/commands/create.ts
git commit -m "feat: implement create command

Parse API docs and generate MCP server with full pipeline.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 13: Implement Validate Command

**Files:**
- Create: `src/commands/validate.ts`

**Step 1: Create validate command**

```typescript
import { detectFormat } from '../parsers/detector.js';
import { parseOpenAPI } from '../parsers/openapi.js';
import { logger } from '../utils/logger.js';

export async function validateCommand(input: string): Promise<void> {
  try {
    logger.info(`Validating: ${input}`);

    const detection = await detectFormat(input);
    logger.success(`Format detected: ${detection.format}`);

    if (detection.format === 'openapi' || detection.format === 'swagger') {
      const schema = parseOpenAPI(detection.content);
      logger.success(`Valid API specification: ${schema.name}`);
      logger.info(`Base URL: ${schema.baseUrl}`);
      logger.info(`Endpoints: ${schema.endpoints.length}`);
      logger.info(`Auth type: ${schema.auth.type}`);
    } else {
      logger.warn('Format detected but parsing not implemented yet');
    }

  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/commands/validate.ts
git commit -m "feat: implement validate command

Validate API specs without generating code.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Implement List Command

**Files:**
- Create: `src/commands/list.ts`

**Step 1: Create list command**

```typescript
import { listServers } from '../registry/manager.js';
import { logger } from '../utils/logger.js';

export async function listCommand(): Promise<void> {
  try {
    const servers = await listServers();

    if (servers.length === 0) {
      logger.info('No MCP servers generated yet');
      return;
    }

    logger.info(`Generated MCP servers (${servers.length}):\n`);

    for (const server of servers) {
      console.log(`  ${server.name}`);
      console.log(`    Path: ${server.path}`);
      console.log(`    Created: ${new Date(server.createdAt).toLocaleString()}\n`);
    }

  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: implement list command

List all generated MCP servers from registry.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 15: Implement Install Command

**Files:**
- Create: `src/commands/install.ts`

**Step 1: Create install command**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getServer } from '../registry/manager.js';
import { logger } from '../utils/logger.js';

export async function installCommand(serverName: string): Promise<void> {
  try {
    // Get server from registry
    const server = await getServer(serverName);
    if (!server) {
      logger.error(`Server not found: ${serverName}`);
      logger.info('Run "mcp-factory list" to see available servers');
      process.exit(1);
    }

    // Check if server build exists
    const buildPath = path.join(server.path, 'build', 'index.js');
    try {
      await fs.access(buildPath);
    } catch {
      logger.error(`Server not built yet. Run:`);
      logger.info(`  cd ${server.path}`);
      logger.info(`  npm install && npm run build`);
      process.exit(1);
    }

    // Determine Claude config paths
    const configPaths = [
      path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      path.join(os.homedir(), '.claude', 'config.json'),
    ];

    let installed = false;

    for (const configPath of configPaths) {
      try {
        await fs.access(configPath);
        await installToConfig(configPath, serverName, buildPath);
        installed = true;

        const configName = configPath.includes('claude_desktop_config.json')
          ? 'Claude Desktop'
          : 'Claude Code';
        logger.success(`Installed ${serverName} to ${configName}`);

      } catch {
        // Config file doesn't exist, skip
      }
    }

    if (!installed) {
      logger.warn('No Claude configuration files found');
      logger.info('Expected locations:');
      configPaths.forEach(p => logger.info(`  ${p}`));
    } else {
      logger.info('\nNext steps:');
      logger.info('  1. Edit the config file and add your API credentials');
      logger.info('  2. Restart Claude Desktop/Code to load the server');
    }

  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

async function installToConfig(
  configPath: string,
  serverName: string,
  buildPath: string
): Promise<void> {
  const content = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(content);

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers[serverName] = {
    command: 'node',
    args: [buildPath],
    env: {
      API_KEY: 'YOUR_API_KEY_HERE',
    },
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 3: Commit**

```bash
git add src/commands/install.ts
git commit -m "feat: implement install command

Auto-configure generated servers in Claude Desktop/Code config.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 16: Wire Up CLI Commands

**Files:**
- Modify: `src/cli.ts`

**Step 1: Import commands**

Add imports at top of file:

```typescript
import { createCommand } from './commands/create.js';
import { validateCommand } from './commands/validate.js';
import { listCommand } from './commands/list.js';
import { installCommand } from './commands/install.js';
```

**Step 2: Add command definitions**

Replace the existing program definition with:

```typescript
program
  .name('mcp-factory')
  .description('Generate production-ready MCP servers from API documentation')
  .version('0.1.0');

program
  .command('create')
  .description('Generate MCP server from API documentation')
  .argument('<input>', 'Path to API spec file or URL')
  .option('--ai-parse', 'Use AI to parse unstructured documentation')
  .option('-o, --output <dir>', 'Output directory for generated server')
  .action(createCommand);

program
  .command('validate')
  .description('Validate API specification without generating code')
  .argument('<input>', 'Path to API spec file')
  .action(validateCommand);

program
  .command('list')
  .description('List all generated MCP servers')
  .action(listCommand);

program
  .command('install')
  .description('Install MCP server to Claude Desktop/Code configuration')
  .argument('<server-name>', 'Name of the server to install')
  .action(installCommand);

program.parse();
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 4: Test CLI help**

Run: `node dist/cli.js --help`
Expected: Shows all commands

**Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: wire up all CLI commands

Connect create, validate, list, install commands to CLI.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 7: Testing and Polish

### Task 17: Test with Sample OpenAPI Spec

**Files:**
- Create: `test-fixtures/weather-api.json`

**Step 1: Create sample OpenAPI spec**

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Weather API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.weather.example.com"
    }
  ],
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    }
  },
  "security": [
    {
      "ApiKeyAuth": []
    }
  ],
  "paths": {
    "/weather": {
      "get": {
        "operationId": "get_weather",
        "summary": "Get current weather for a city",
        "parameters": [
          {
            "name": "city",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response"
          }
        }
      }
    }
  }
}
```

**Step 2: Test create command**

Run: `node dist/cli.js create test-fixtures/weather-api.json`
Expected: Generates weather-api-mcp directory

**Step 3: Verify generated files**

Run: `ls weather-api-mcp/`
Expected: Shows package.json, tsconfig.json, src/, README.md

**Step 4: Test generated server builds**

Run: `cd weather-api-mcp && npm install && npm run build`
Expected: Compiles successfully

**Step 5: Test list command**

Run: `node dist/cli.js list`
Expected: Shows weather-api in registry

**Step 6: Commit test fixture**

```bash
git add test-fixtures/
git commit -m "test: add sample Weather API OpenAPI spec for testing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 18: Add NPM Bin Setup

**Files:**
- Modify: `package.json`

**Step 1: Update package.json bin section**

Ensure the bin section is correct and add prepare script:

```json
{
  "bin": {
    "mcp-factory": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "node --test dist/**/*.test.js",
    "prepare": "npm run build"
  }
}
```

**Step 2: Make CLI executable**

Run: `chmod +x dist/cli.js`

**Step 3: Test global install locally**

Run: `npm link`
Run: `mcp-factory --version`
Expected: Shows version number

**Step 4: Unlink after testing**

Run: `npm unlink -g @mcp-factory/cli`

**Step 5: Commit**

```bash
git add package.json
git commit -m "feat: configure npm bin for global CLI installation

Enables 'mcp-factory' command when installed globally.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 19: Create README for CLI Project

**Files:**
- Create: `README.md`

**Step 1: Create comprehensive README**

```markdown
# MCP Factory

Generate production-ready MCP servers from API documentation in one command.

## Installation

```bash
npm install -g @mcp-factory/cli
```

## Quick Start

```bash
# Generate MCP server from OpenAPI spec
mcp-factory create openapi.json

# Install to Claude Desktop/Code
cd my-api-mcp
npm install && npm run build
mcp-factory install my-api

# List generated servers
mcp-factory list
```

## Commands

### create

Generate an MCP server from API documentation:

```bash
mcp-factory create <input> [options]

Options:
  --ai-parse        Use AI to parse unstructured documentation
  -o, --output <dir>  Output directory for generated server
```

**Supported input formats:**
- OpenAPI 3.x (JSON/YAML)
- Swagger 2.0 (JSON/YAML)
- Postman collections (coming soon)
- Unstructured docs with `--ai-parse` (coming soon)

### validate

Validate API specification without generating code:

```bash
mcp-factory validate <input>
```

### list

List all generated MCP servers:

```bash
mcp-factory list
```

### install

Install generated server to Claude Desktop/Code configuration:

```bash
mcp-factory install <server-name>
```

## Generated Server Structure

```
my-api-mcp/
├── src/
│   ├── index.ts      # MCP server entry point
│   ├── client.ts     # HTTP client with auth
│   └── tools.ts      # Tool implementations
├── package.json
├── tsconfig.json
└── README.md
```

## Development

```bash
# Clone and setup
git clone <repo>
cd mcp-factory
npm install

# Build
npm run build

# Test with sample
node dist/cli.js create test-fixtures/weather-api.json
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README for MCP Factory CLI

Usage instructions, commands, and quick start guide.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 8: Final Verification

### Task 20: End-to-End Test

**Step 1: Clean previous test output**

Run: `rm -rf weather-api-mcp`

**Step 2: Run full generation pipeline**

Run: `node dist/cli.js create test-fixtures/weather-api.json`
Expected: Success message

**Step 3: Build generated server**

Run: `cd weather-api-mcp && npm install && npm run build`
Expected: Build succeeds, creates build/index.js

**Step 4: Verify generated server structure**

Run: `ls -R`
Expected: All expected files present

**Step 5: Check README has correct config**

Run: `cat README.md`
Expected: Contains Claude config with correct paths

**Step 6: Return to CLI directory**

Run: `cd ..`

**Step 7: Commit final state**

```bash
git add -A
git commit -m "test: verify end-to-end MCP server generation

Complete pipeline test from OpenAPI spec to built MCP server.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan delivers a working MCP Factory CLI with:

✓ Core architecture (CLI, parsers, generator, registry)
✓ OpenAPI/Swagger parsing
✓ Template-based code generation
✓ Pattern detection (auth, pagination, rate limiting)
✓ Registry management
✓ All four commands (create, validate, list, install)
✓ End-to-end tested with sample API

**Not included (future work):**
- Postman collection parser (stub created)
- AI-powered parsing (stub created)
- Advanced templates (types, validation, comprehensive tests)
- OAuth flow handling
- Webhook support

**Ready to execute:** Use @superpowers:executing-plans or @superpowers:subagent-driven-development
