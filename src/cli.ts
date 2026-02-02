#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('mcp-factory')
  .description('Generate production-ready MCP servers from API documentation')
  .version('0.1.0');

program.parse();
