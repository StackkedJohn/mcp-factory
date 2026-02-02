# MCP Factory Design

**Date:** 2026-02-02
**Status:** Approved

## Problem Statement

Building MCP servers from API documentation requires significant manual effort for each new API. This design establishes a framework to eliminate this repetitive work by generating production-ready MCP servers from API documentation in a single Claude Code session.

## Goal

Create a CLI tool that transforms API documentation (OpenAPI specs, Swagger, Postman collections, raw docs, or URLs) into complete, production-ready MCP servers that work immediately with Claude Desktop and Claude Code, requiring zero additional work.

## Success Criteria

- Generate working MCP servers from any API documentation in one command
- Follow best practices (TypeScript, proper validation, error handling, logging)
- Handle auth patterns automatically (API keys, Bearer tokens, OAuth, etc.)
- Work immediately with Claude Desktop/Code without configuration debugging
- Include tests that validate server functionality
- Produce comprehensive documentation
- Generate zero technical debt

---

## System Overview

The MCP Factory is a TypeScript-based CLI tool that transforms API documentation into production-ready MCP servers through a three-stage pipeline:

### Stage 1: Input Processing

The CLI accepts diverse inputs (file paths, URLs, or current directory scan) and auto-detects the format. A format detector identifies OpenAPI/Swagger specs (JSON/YAML), Postman collections, or raw documentation. Structured formats are parsed directly using specialized parsers. When structured specs aren't found, an optional AI-powered parser (using Claude API with `--ai-parse` flag) extracts API structure from unstructured docs.

### Stage 2: Normalization

All parsers output a unified internal schema called `APISchema`. This schema captures endpoints, parameters, authentication requirements, request/response types, pagination patterns, rate limiting info, and error response structures. The normalization layer ensures the generation stage works with consistent data regardless of input format.

### Stage 3: Code Generation

A template engine uses the `APISchema` to generate a complete TypeScript MCP server package. Templates are pattern-aware - they detect cursor vs offset pagination, different auth patterns, rate limit headers, etc., and generate code specific to what the API actually uses. The output is a minimal but complete package ready for immediate use.

### CLI State Management

The tool maintains a simple registry (`~/.mcp-factory/registry.json`) tracking generated servers for the `list` and `install` commands.

---

## CLI Architecture

### Project Structure

```
mcp-factory/
├── src/
│   ├── cli.ts              # Entry point, command routing
│   ├── commands/
│   │   ├── create.ts       # Create command logic
│   │   ├── validate.ts     # Validate command logic
│   │   ├── list.ts         # List command logic
│   │   └── install.ts      # Install command logic
│   ├── parsers/
│   │   ├── detector.ts     # Format auto-detection
│   │   ├── openapi.ts      # OpenAPI/Swagger parser
│   │   ├── postman.ts      # Postman collection parser
│   │   └── ai-parser.ts    # Claude API-powered parser
│   ├── schema/
│   │   └── api-schema.ts   # Unified APISchema type definitions
│   ├── generator/
│   │   ├── engine.ts       # Template engine core
│   │   ├── analyzer.ts     # Pattern detection (pagination, auth, etc.)
│   │   └── templates/      # Handlebars templates
│   ├── registry/
│   │   └── manager.ts      # Registry CRUD operations
│   └── utils/
│       ├── errors.ts       # Error handling utilities
│       └── logger.ts       # CLI logging
├── templates/              # Template files (copied to dist)
└── package.json
```

### Technology Stack

- **Commander.js** for CLI parsing
- **Handlebars** for templating
- **Zod** for schema validation
- **Anthropic SDK** for AI parsing (optional)
- **openapi-typescript** for OpenAPI parsing

The CLI is published as `@mcp-factory/cli` on npm and installed globally with `npm install -g @mcp-factory/cli`.

### CLI Commands

- `mcp-factory create <input>` - Generate MCP server from API documentation
- `mcp-factory validate <input>` - Validate API spec without generating code
- `mcp-factory list` - List all generated servers from registry
- `mcp-factory install <server-name>` - Auto-configure server in Claude Desktop/Code
- `mcp-factory --version` - Display CLI version
- `mcp-factory --help` - Show help information

---

## Input Processing Pipeline

### Format Detection & Parsing Flow

When you run `mcp-factory create <input>`, the detector examines the input:

1. If input is a URL, fetch the content first
2. Check file extension (.json, .yaml, .yml)
3. Parse and look for OpenAPI indicators (`openapi: "3.0"`, `swagger: "2.0"`)
4. Check for Postman collection structure (`info.schema` field)
5. If no structured format found and `--ai-parse` flag present, use AI parser
6. Otherwise, fail with helpful error: "Could not detect format. Use --ai-parse for unstructured docs."

### Unified APISchema

Each parser transforms its input into the unified `APISchema`:

```typescript
interface APISchema {
  name: string;                    // API name for package naming
  baseUrl: string;                 // Base API URL
  auth: AuthConfig;                // Auth pattern detected
  endpoints: Endpoint[];           // All available endpoints
  commonHeaders?: Record<string, string>;
  rateLimit?: RateLimitConfig;
  pagination?: PaginationConfig;
}

interface Endpoint {
  id: string;                      // Unique identifier for MCP tool
  method: string;                  // HTTP method
  path: string;                    // URL path with {params}
  description: string;             // Tool description
  parameters: Parameter[];         // Query, path, body params
  response: ResponseSchema;        // Expected response structure
  errors: ErrorSchema[];           // Known error responses
}
```

### AI Parser

The AI parser prompts Claude API with: "Extract API structure from these docs" and formats the response into `APISchema`. This handles unstructured documentation, raw HTML docs, curl examples, and incomplete specifications.

---

## Code Generation Engine

### Pattern Analysis

Before generating code, the analyzer examines the `APISchema` to detect specific patterns:

```typescript
interface DetectedPatterns {
  authPattern: 'api-key' | 'bearer' | 'oauth' | 'basic' | 'none';
  paginationStyle?: 'cursor' | 'offset' | 'page' | 'link-header';
  rateLimitStrategy?: 'header-based' | 'retry-after' | 'none';
  errorFormat: 'standard' | 'custom';
  hasWebhooks: boolean;
}
```

### Template System

The engine uses Handlebars templates with the `APISchema` + `DetectedPatterns` as context:

**Core Templates:**
- `index.ts.hbs` - Main server with MCP SDK setup, tool registration
- `client.ts.hbs` - HTTP client with auth, retry logic, rate limiting
- `tools.ts.hbs` - Individual tool handlers for each endpoint
- `types.ts.hbs` - TypeScript interfaces from API schemas
- `validation.ts.hbs` - Zod schemas for input validation
- `test.ts.hbs` - Basic smoke test using Node test runner
- `package.json.hbs` - Dependencies and scripts
- `tsconfig.json.hbs` - TypeScript configuration
- `README.md.hbs` - Usage instructions and Claude config

Templates use conditionals (e.g., `{{#if patterns.pagination}}`) to only generate code for detected patterns. Each endpoint becomes an MCP tool with:
- Defensive input validation
- Detailed error messages
- Typed request/response handling
- Retry logic for rate limits/timeouts

---

## Generated Server Structure

### Output Package Layout

```
weather-api-mcp/
├── src/
│   ├── index.ts          # Main: MCP server setup, tool registration
│   ├── client.ts         # HTTP client with auth & error handling
│   ├── tools.ts          # Tool handler implementations
│   ├── types.ts          # TypeScript interfaces for API models
│   └── validation.ts     # Zod schemas for input validation
├── build/                # Compiled output (after npm run build)
│   └── index.js
├── test.ts               # Basic smoke test
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript config
└── README.md             # Usage docs & Claude config instructions
```

### Key Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0",
    "node-fetch": "^3.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "node --test test.ts"
  }
}
```

### Generated Server Workflow

```bash
cd weather-api-mcp
npm install
npm run build
npm test      # Validates server starts correctly
```

The generated server uses stdio transport and expects configuration (API keys) via the MCP config JSON when added to Claude Desktop/Code.

---

## Installation and Configuration

### Auto-Configuration with `install` Command

The `mcp-factory install <server-name>` command automates adding generated servers to Claude Desktop and Claude Code configurations.

**Configuration File Locations:**
- **Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Code:** `~/.claude/config.json`

### Install Process

1. Looks up server in registry (`~/.mcp-factory/registry.json`)
2. Detects which Claude clients are installed (Desktop and/or Code)
3. Reads existing config files
4. Adds server entry with appropriate paths and env placeholders
5. Writes updated config back
6. Displays next steps (add API keys)

### Generated Config Entry

```json
{
  "mcpServers": {
    "weather-api": {
      "command": "node",
      "args": ["/absolute/path/to/weather-api-mcp/build/index.js"],
      "env": {
        "API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### User Action Required

The install command outputs:
```
✓ Installed weather-api to Claude Desktop
→ Edit config and replace YOUR_API_KEY_HERE with your actual API key
→ Restart Claude Desktop to load the server
```

---

## Design Decisions Summary

| Decision Point | Choice | Rationale |
|---------------|--------|-----------|
| Architecture | CLI code generation tool | Transparent, maintainable, no runtime dependencies |
| Input Handling | Auto-detect with AI fallback | Handles structured specs efficiently, AI for edge cases |
| Output Structure | Minimal monorepo-friendly package | Professional but lean, ready for production |
| Testing | One test file (Node built-in) | Validates functionality without external framework |
| Auth Config | MCP config JSON | Standard pattern, keeps secrets out of code |
| Code Generation | Template-based | Fast, deterministic, no API costs |
| Pattern Handling | Detect and generate | Lean output, API-specific code only |
| Error Handling | Defensive with detailed errors | Production-ready, easy debugging |
| CLI Commands | create, validate, list, install | Covers essential workflows without overengineering |

---

## Next Steps

1. Set up git worktree for isolated development
2. Create detailed implementation plan
3. Phase-by-phase implementation with validation checkpoints
