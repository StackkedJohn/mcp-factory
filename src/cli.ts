#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createCommand } from './commands/create.js';
import { validateCommand } from './commands/validate.js';
import { listCommand } from './commands/list.js';
import { installCommand } from './commands/install.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('mcp-factory')
  .description('Generate production-ready MCP servers from API documentation')
  .version(packageJson.version);

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
