import * as path from 'path';
import { detectFormat } from '../parsers/detector.js';
import { parseOpenAPI } from '../parsers/openapi.js';
import { parsePostman } from '../parsers/postman.js';
import { parseAPIBlueprint } from '../parsers/apib-parser.js';
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
    } else if (detection.format === 'apib') {
      schema = await parseAPIBlueprint(detection.content);
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
