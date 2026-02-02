# Changelog

All notable changes to MCP Factory will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-02-02

### Fixed
- API Blueprint parser now recursively traverses nested categories to find all resources
- Template properly escapes multiline descriptions and special characters using JSON.stringify
- Tested with Cin7 Core API: Successfully parsed 102 resources with 295 tool endpoints

## [0.2.2] - 2026-02-02

### Fixed
- CLI now reads version dynamically from package.json instead of hardcoded value
- Fixes issue where `mcp-factory --version` always showed 0.1.0

## [0.2.1] - 2026-02-02

### Fixed
- Removed circular self-dependency from package.json

## [0.2.0] - 2026-02-02

### Added
- **API Blueprint (.apib) format support** - Full support for API Blueprint documentation format
- Format detector recognizes .apib file extensions and FORMAT: 1A markers
- API Blueprint parser using drafter.js (pure JavaScript, no native dependencies)
- Support for nested resource groups, multiline descriptions, and URI templates
- Integration into create command for seamless .apib file processing

### Changed
- Updated README with API Blueprint examples and usage
- Enhanced format detection logic

## [0.1.1] - 2026-02-01

### Initial Release
- Generate MCP servers from OpenAPI 3.x and Swagger 2.0 specifications
- Automatic Claude Desktop and Claude Code configuration via `install` command
- Registry system to track generated servers
- Pattern detection for auth, pagination, and error handling
- TypeScript code generation with type safety and validation
- Built-in templates for all server components

[0.2.3]: https://github.com/StackkedJohn/mcp-factory/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/StackkedJohn/mcp-factory/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/StackkedJohn/mcp-factory/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/StackkedJohn/mcp-factory/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/StackkedJohn/mcp-factory/releases/tag/v0.1.1
