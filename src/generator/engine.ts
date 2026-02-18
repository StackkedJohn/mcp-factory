import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { APISchema, DetectedPatterns } from '../schema/api-schema.js';
import { buildTemplateContext } from './context-builder.js';
import { GenerationError } from '../utils/errors.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Handlebars.registerHelper('eq', (a, b) => a === b);

Handlebars.registerHelper('jsString', (str: string) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
});

export async function generateServer(
  schema: APISchema,
  patterns: DetectedPatterns,
  outputDir: string
): Promise<void> {
  const context = buildTemplateContext(schema, patterns, path.resolve(outputDir));

  await fs.mkdir(path.join(outputDir, 'src'), { recursive: true });

  const templateDir = path.join(__dirname, '..', '..', 'templates');

  await generateFile(templateDir, outputDir, 'package.json.hbs', 'package.json', context);
  await generateFile(templateDir, outputDir, 'tsconfig.json.hbs', 'tsconfig.json', context);
  await generateFile(templateDir, outputDir, 'README.md.hbs', 'README.md', context);
  await generateFile(templateDir, outputDir, 'index.ts.hbs', 'src/index.ts', context);
  await generateFile(templateDir, outputDir, 'client.ts.hbs', 'src/client.ts', context);
  await generateFile(templateDir, outputDir, 'tools.ts.hbs', 'src/tools.ts', context);
  await generateFile(templateDir, outputDir, 'types.ts.hbs', 'src/types.ts', context);
  await generateFile(templateDir, outputDir, 'validation.ts.hbs', 'src/validation.ts', context);
}

async function generateFile(
  templateDir: string,
  outputDir: string,
  templateFile: string,
  outputFile: string,
  context: any
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
