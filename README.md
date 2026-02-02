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
