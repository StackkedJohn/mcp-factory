import { APISchema } from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

export function parsePostman(collection: any): APISchema {
  throw new ParseError('Postman collection parsing not yet implemented');
}
