# MCP Factory

**Transform any API documentation into a production-ready MCP server in seconds.**

MCP Factory is a CLI tool that generates complete, type-safe Model Context Protocol (MCP) servers from API documentation. Give it an OpenAPI spec, Swagger doc, or YAML file, and get a working MCP server with hundreds of tools ready for Claude Desktop and Claude Code.

[![npm version](https://badge.fury.io/js/@stackkedjohn%2Fmcp-factory-cli.svg)](https://www.npmjs.com/package/@stackkedjohn/mcp-factory-cli)
[![GitHub](https://img.shields.io/github/license/StackkedJohn/mcp-factory)](https://github.com/StackkedJohn/mcp-factory)

## Why MCP Factory?

- **Zero manual coding** - Generates complete TypeScript MCP servers automatically
- **Production-ready output** - Type-safe code with validation, error handling, and auth
- **Complete API coverage** - Every endpoint becomes an MCP tool
- **Works anywhere** - Run from any directory, point to any API docs
- **One-command install** - Automatically configures Claude Desktop/Code

## Installation

```bash
npm install -g @stackkedjohn/mcp-factory-cli
```

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

# Done! Restart Claude and start using it
```

## Real Example: Neon CRM API

```bash
# Generate from 466KB OpenAPI spec
mcp-factory create ./neon-crm-v2.11.yaml

# Output:
# ✓ Parsed API: Neon CRM API Reference
# ✓ Generated 308 tools (5,772 lines of code)
# ✓ Build time: <3 seconds

cd "Neon CRM API Reference-mcp"
npm install && npm run build
mcp-factory install "Neon CRM API Reference"

# Now in Claude:
# "Get customer 12345 from Neon CRM"
# "Create a new donation for $100"
# "List all upcoming events"
```

## Real Example: API Blueprint Format

```bash
# Generate from API Blueprint (.apib) file
mcp-factory create ./dearinventory.apib

# Output:
# ✓ Parsed API: Cin7 Core Developer Portal
# ✓ Generated 295 tools (4,877 lines of code)
# ✓ Full support for nested categories and complex descriptions

cd "Cin7 Core Developer Portal-mcp"
npm install && npm run build
mcp-factory install "Cin7 Core Developer Portal"

# API Blueprint features:
# ✓ Nested resource groups
# ✓ Multiline descriptions with formatting
# ✓ URI templates with parameters
# ✓ Multiple actions per resource
```

## What Gets Generated

```
My API-mcp/
├── src/
│   ├── index.ts          # MCP server implementation
│   ├── client.ts         # HTTP client with auth & retry logic
│   ├── tools.ts          # Tool handlers for each endpoint
│   ├── types.ts          # TypeScript type definitions
│   └── validation.ts     # Zod schemas for input validation
├── build/                # Compiled JavaScript
├── package.json          # Dependencies & scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # Usage instructions & Claude config
```

### Generated Code Features

- ✅ **Type Safety** - Full TypeScript types and Zod validation
- ✅ **Authentication** - Handles OAuth, API keys, Bearer tokens
- ✅ **Error Handling** - Detailed error messages and retry logic
- ✅ **Rate Limiting** - Automatic retry with exponential backoff
- ✅ **Documentation** - Complete README with configuration examples
- ✅ **Tests** - Basic smoke tests included

## Commands

### `create`

Generate an MCP server from API documentation.

```bash
mcp-factory create <input> [options]

Arguments:
  input                 Path to API documentation file or URL

Options:
  --ai-parse           Use AI to parse unstructured documentation (coming soon)
  -o, --output <dir>   Custom output directory (default: ./<API Name>-mcp)
```

**Supported Formats:**
- OpenAPI 3.x (JSON/YAML)
- Swagger 2.0 (JSON/YAML)
- API Blueprint (.apib)
- Postman Collections (coming soon)
- Unstructured docs with `--ai-parse` (coming soon)

**Examples:**
```bash
# Local file
mcp-factory create ./openapi.yaml

# API Blueprint file
mcp-factory create ./api-documentation.apib

# URL (coming soon)
mcp-factory create https://api.example.com/openapi.json

# Custom output directory
mcp-factory create ./swagger.json -o ./custom-mcp
```

### `validate`

Validate API specification without generating code.

```bash
mcp-factory validate <input>
```

Checks if the API documentation is valid and can be processed.

### `list`

List all generated MCP servers tracked by the registry.

```bash
mcp-factory list
```

Shows all servers you've generated with their paths and creation dates.

### `install`

Automatically configure a generated server in Claude Desktop or Claude Code.

```bash
mcp-factory install <server-name>
```

**What it does:**
- Locates server in registry
- Detects Claude Desktop and/or Claude Code
- Updates configuration with correct paths
- Provides next steps for adding API credentials

**Configuration files:**
- **Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
- **Claude Code:** `~/.claude/config.json`

## Complete Workflow

### 1. Generate Server

```bash
cd ~/my-projects
mcp-factory create ./stripe-openapi.yaml
```

**Output:**
```
ℹ Detecting format: OpenAPI 3.0
✓ Parsed API: Stripe API
ℹ Detected patterns: auth=bearer, pagination=cursor
✓ Generated MCP server with 247 tools
```

### 2. Build & Test

```bash
cd "Stripe API-mcp"
npm install
npm run build
npm test
```

**Generated files:**
- `build/index.js` - Compiled MCP server
- `src/*.ts` - TypeScript source code
- Tests pass ✓

### 3. Install to Claude

```bash
mcp-factory install "Stripe API"
```

**Output:**
```
✓ Installed Stripe API to Claude Desktop

Next steps:
  1. Edit config and add API credentials
  2. Restart Claude Desktop to load server
```

### 4. Add Credentials

Edit Claude Desktop config:

```json
{
  "mcpServers": {
    "Stripe API": {
      "command": "node",
      "args": ["/path/to/Stripe API-mcp/build/index.js"],
      "env": {
        "STRIPE_API_KEY": "sk_live_..."
      }
    }
  }
}
```

### 5. Use in Claude

Restart Claude Desktop, then:

```
"List my Stripe customers"
"Create a new payment intent for $50"
"Get details for charge ch_abc123"
```

Claude automatically uses the MCP server tools to make API calls.

## How It Works

1. **Format Detection** - Analyzes your documentation and identifies the format
2. **API Parsing** - Extracts endpoints, parameters, auth patterns, and schemas
3. **Pattern Analysis** - Detects pagination, rate limiting, and error formats
4. **Code Generation** - Creates TypeScript MCP server with Handlebars templates
5. **Optimization** - Only generates code for patterns your API actually uses

**Key Design Decisions:**
- Generate code, don't use runtime abstraction (transparent, no black box)
- TypeScript for type safety and IDE support
- Minimal dependencies (MCP SDK, Zod, Handlebars)
- Pattern-aware generation (lean output, no unused code)

## Development

### Setup

```bash
git clone https://github.com/StackkedJohn/mcp-factory.git
cd mcp-factory
npm install
npm run build
```

### Local Testing

```bash
# Test with sample OpenAPI spec
node dist/cli.js create test-fixtures/weather-api.json

# Test generated server
cd "Weather API-mcp"
npm install && npm run build && npm test
```

### Project Structure

```
mcp-factory/
├── src/
│   ├── cli.ts                    # CLI entry point
│   ├── commands/                 # Command implementations
│   ├── parsers/                  # Format parsers (OpenAPI, Postman)
│   ├── generator/                # Code generation engine
│   ├── schema/                   # Internal API schema types
│   ├── registry/                 # Server registry management
│   └── utils/                    # Logging, errors
├── templates/                    # Handlebars templates
│   ├── index.ts.hbs             # MCP server template
│   ├── client.ts.hbs            # HTTP client template
│   ├── tools.ts.hbs             # Tool handlers template
│   └── ...
├── test-fixtures/               # Sample API specs
└── docs/                        # Design docs
```

## Troubleshooting

### Generated server won't start

```bash
# Check build succeeded
npm run build

# Check for TypeScript errors
npm run build -- --noEmit
```

### Tools not appearing in Claude

1. Verify server is in Claude config
2. Check server path is absolute, not relative
3. Restart Claude Desktop/Code
4. Check Claude logs for errors

### Authentication failures

1. Verify API credentials in config `env` section
2. Check API key format matches your API's requirements
3. Test credentials with curl first

## Links

- **npm Package:** https://www.npmjs.com/package/@stackkedjohn/mcp-factory-cli
- **GitHub Repository:** https://github.com/StackkedJohn/mcp-factory
- **Issues & Support:** https://github.com/StackkedJohn/mcp-factory/issues
- **MCP Documentation:** https://modelcontextprotocol.io

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions welcome! Please open an issue first to discuss proposed changes.

---

**Built with ❤️ for the Claude MCP ecosystem**
