import { APISchema, DetectedPatterns } from '../schema/api-schema.js';

export function analyzePatterns(schema: APISchema): DetectedPatterns {
  return {
    authPattern: schema.auth.type,
    paginationStyle: schema.pagination?.style,
    rateLimitStrategy: schema.rateLimit?.strategy || 'none',
    errorFormat: detectErrorFormat(schema),
    hasWebhooks: false,
  };
}

function detectErrorFormat(schema: APISchema): 'standard' | 'custom' {
  // Check if any endpoint has custom error schemas
  const hasCustomErrors = schema.endpoints.some(
    endpoint => endpoint.errors.length > 0 && endpoint.errors.some(e => e.schema)
  );

  return hasCustomErrors ? 'custom' : 'standard';
}
