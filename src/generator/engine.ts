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

// Register Handlebars helper for JSON stringification
Handlebars.registerHelper('json', (value) => JSON.stringify(value));

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
