import { APISchema } from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

export async function parseWithAI(content: string): Promise<APISchema> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ParseError('ANTHROPIC_API_KEY environment variable required for AI parsing');
  }

  throw new ParseError('AI-powered parsing not yet implemented');
}
