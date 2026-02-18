import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { parseOpenAPI } from '../parsers/openapi.js';
import { analyzePatterns } from '../generator/analyzer.js';
import { generateServer } from '../generator/engine.js';

describe('Integration: generate + compile', () => {
  it('generates a valid TypeScript server from weather fixture', async () => {
    const fixturePath = path.join(process.cwd(), 'test-fixtures', 'weather-api.json');
    const spec = JSON.parse(await fs.readFile(fixturePath, 'utf-8'));
    const schema = parseOpenAPI(spec);
    const patterns = analyzePatterns(schema);

    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-'));

    try {
      await generateServer(schema, patterns, outputDir);

      // Verify files exist
      const files = await fs.readdir(path.join(outputDir, 'src'));
      assert.ok(files.includes('index.ts'), 'index.ts generated');
      assert.ok(files.includes('client.ts'), 'client.ts generated');
      assert.ok(files.includes('tools.ts'), 'tools.ts generated');
      assert.ok(files.includes('types.ts'), 'types.ts generated');
      assert.ok(files.includes('validation.ts'), 'validation.ts generated');

      // Verify tool name from operationId
      const toolsContent = await fs.readFile(path.join(outputDir, 'src', 'tools.ts'), 'utf-8');
      assert.ok(toolsContent.includes("name: 'get_weather'"), 'tool name from operationId');

      // Verify auth header
      const clientContent = await fs.readFile(path.join(outputDir, 'src', 'client.ts'), 'utf-8');
      assert.ok(clientContent.includes('X-API-Key'), 'API key header name from spec');
      assert.ok(clientContent.includes('WEATHER_API_API_KEY'), 'env var uses API name prefix');

      // Verify query params separated
      assert.ok(toolsContent.includes('queryParams'), 'query params separated in handler');

      // Verify types generated
      const typesContent = await fs.readFile(path.join(outputDir, 'src', 'types.ts'), 'utf-8');
      assert.ok(typesContent.includes('get_weatherParams'), 'TypeScript interface generated');

      // Verify validation generated
      const validationContent = await fs.readFile(path.join(outputDir, 'src', 'validation.ts'), 'utf-8');
      assert.ok(validationContent.includes('get_weatherSchema'), 'Zod schema generated');

      // Install and compile
      execFileSync('npm', ['install'], { cwd: outputDir, stdio: 'pipe' });
      execFileSync('npm', ['run', 'build'], { cwd: outputDir, stdio: 'pipe' });

    } finally {
      await fs.rm(outputDir, { recursive: true, force: true });
    }
  });

  it('replaces bad operationIds and includes request body params', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://api.example.com' }],
      paths: {
        '/users': {
          get: {
            operationId: 'listUsingGET',
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/users/{id}': {
          get: {
            operationId: 'get_3',
            summary: 'Get user',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
            responses: { '200': { description: 'OK' } },
          },
        },
        '/posts': {
          post: {
            summary: 'Create post',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      body: { type: 'string' },
                    },
                    required: ['title'],
                  },
                },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };

    const schema = parseOpenAPI(spec);
    const patterns = analyzePatterns(schema);
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-test-names-'));

    try {
      await generateServer(schema, patterns, outputDir);
      const toolsContent = await fs.readFile(path.join(outputDir, 'src', 'tools.ts'), 'utf-8');

      // Bad operationIds replaced
      assert.ok(!toolsContent.includes("'listUsingGET'"), 'listUsingGET replaced');
      assert.ok(!toolsContent.includes("'get_3'"), 'get_3 replaced');

      // Request body params included
      assert.ok(toolsContent.includes("'title'"), 'request body title param');
      assert.ok(toolsContent.includes("'body'"), 'request body body param');

      // Path params separated
      assert.ok(toolsContent.includes('pathParams'), 'path params separated');

    } finally {
      await fs.rm(outputDir, { recursive: true, force: true });
    }
  });
});
