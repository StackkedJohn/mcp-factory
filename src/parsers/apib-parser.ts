import drafterModule from 'drafter.js';
import type {
  APISchema,
  AuthConfig,
  Endpoint,
  Parameter,
  RequestBody,
  ResponseSchema,
  ErrorSchema,
  SchemaType,
} from '../schema/api-schema.js';
import { ParseError } from '../utils/errors.js';

// Type assertion for drafter.js API (type definitions are incomplete)
const drafter = drafterModule as any;

// Helper to check if element has a class
function hasClass(element: any, className: string): boolean {
  if (!element?.meta?.classes) return false;
  if (element.meta.classes.element === 'array') {
    return element.meta.classes.content.some((c: any) => c.content === className);
  }
  return false;
}

export async function parseAPIBlueprint(content: string): Promise<APISchema> {
  try {
    // Parse the API Blueprint document using drafter.js (synchronous)
    const result = drafter.parseSync(content, {});

    // Check for parsing errors
    if (result.error) {
      throw new ParseError(`API Blueprint parsing failed: ${result.error.message}`);
    }

    const ast = result;

    // Extract API metadata
    const apiMetadata = ast.content[0];
    const name = apiMetadata.meta?.title?.content || 'Untitled API';
    const baseUrl = extractBaseUrl(ast);

    // Extract all endpoints with recursive category traversal
    const endpoints: Endpoint[] = [];

    function extractEndpoints(items: any[]) {
      for (const item of items) {
        if (item.element === 'resource') {
          const resourcePath = item.attributes?.href?.content || '';

          for (const transition of item.content || []) {
            if (transition.element === 'transition') {
              const transaction = transition.content?.find((c: any) => c.element === 'httpTransaction');
              if (transaction) {
                const endpoint = parseAction(transaction, resourcePath, transition);
                endpoints.push(endpoint);
              }
            }
          }
        } else if (item.element === 'category' && item.content) {
          // Recursively process nested categories
          extractEndpoints(item.content);
        }
      }
    }

    extractEndpoints(ast.content);

    // Detect authentication
    const auth = detectAuth(ast);

    return {
      name,
      baseUrl,
      auth,
      endpoints,
    };
  } catch (error) {
    if (error instanceof ParseError) {
      throw error;
    }
    throw new ParseError(`Failed to parse API Blueprint: ${(error as Error).message}`);
  }
}

function extractBaseUrl(ast: any): string {
  // Look for HOST in metadata within category
  for (const element of ast.content) {
    if (element.element === 'category' && hasClass(element, 'api')) {
      // Check attributes.metadata array
      if (element.attributes?.metadata?.element === 'array') {
        for (const metaItem of element.attributes.metadata.content) {
          if (metaItem.element === 'member') {
            const key = metaItem.content?.key?.content;
            if (key === 'HOST') {
              return metaItem.content.value.content;
            }
          }
        }
      }
    }
  }

  return 'https://api.example.com';
}

function parseAction(transaction: any, resourcePath: string, transition: any): Endpoint {
  const request = transaction.content.find((c: any) => c.element === 'httpRequest');
  const response = transaction.content.find((c: any) => c.element === 'httpResponse');

  const method = (request?.attributes?.method?.content || 'GET').toUpperCase() as Endpoint['method'];
  const path = request?.attributes?.href?.content || resourcePath;

  // Extract description - check transition's copy element first, then meta.title
  let description = '';
  const copyElement = transition.content.find((c: any) => c.element === 'copy');
  if (copyElement?.content) {
    description = copyElement.content;
  } else if (transition.meta?.title?.content) {
    description = transition.meta.title.content;
  } else if (transaction.meta?.title?.content) {
    description = transaction.meta.title.content;
  } else if (request?.meta?.title?.content) {
    description = request.meta.title.content;
  }

  // Parse parameters
  const parameters = parseParameters(request);

  // Parse request body
  const requestBody = parseRequestBody(request);

  // Parse response
  const responseSchema = parseResponse(response);

  // Parse errors (look for non-2xx responses)
  const errors = parseErrors(transaction);

  const id = `${method.toLowerCase()}-${path.replace(/\//g, '-').replace(/[{}]/g, '')}`;

  return {
    id,
    method,
    path,
    description,
    parameters,
    requestBody,
    response: responseSchema,
    errors,
  };
}

function parseParameters(request: any): Parameter[] {
  const parameters: Parameter[] = [];

  if (!request?.attributes?.hrefVariables) {
    return parameters;
  }

  const hrefVariables = request.attributes.hrefVariables.content;

  for (const variable of hrefVariables) {
    if (variable.element === 'member') {
      const name = variable.content.key.content;
      const description = variable.meta?.description?.content || '';
      const required = variable.attributes?.typeAttributes?.includes('required') || false;

      // Determine parameter location
      let location: Parameter['in'] = 'path';
      if (variable.attributes?.typeAttributes?.includes('query')) {
        location = 'query';
      } else if (variable.attributes?.typeAttributes?.includes('header')) {
        location = 'header';
      }

      const schema = mapTypeToSchemaType(variable.content.value.element);

      parameters.push({
        name,
        in: location,
        description,
        required,
        schema,
      });
    }
  }

  return parameters;
}

function parseRequestBody(request: any): RequestBody | undefined {
  if (!request?.content) {
    return undefined;
  }

  const asset = request.content.find((c: any) => c.element === 'asset');
  if (!asset) {
    return undefined;
  }

  const contentType = asset.attributes?.contentType?.content || 'application/json';
  const bodyContent = asset.content;

  // Try to parse body as JSON to infer schema
  let schema: SchemaType = { type: 'object' };
  if (bodyContent) {
    try {
      const parsed = JSON.parse(bodyContent);
      schema = inferSchemaFromValue(parsed);
    } catch {
      // If not JSON, keep as generic object
      schema = { type: 'object' };
    }
  }

  return {
    required: true,
    contentType,
    schema,
  };
}

function parseResponse(response: any): ResponseSchema {
  const statusCode = parseInt(response?.attributes?.statusCode?.content || '200');
  const description = response?.meta?.title?.content || '';

  let contentType = 'application/json';
  let schema: SchemaType = { type: 'object' };

  if (response?.content) {
    const asset = response.content.find((c: any) => c.element === 'asset');
    if (asset) {
      contentType = asset.attributes?.contentType?.content || 'application/json';
      const bodyContent = asset.content;

      if (bodyContent) {
        try {
          const parsed = JSON.parse(bodyContent);
          schema = inferSchemaFromValue(parsed);
        } catch {
          schema = { type: 'object' };
        }
      }
    }
  }

  return {
    statusCode,
    description,
    contentType,
    schema,
  };
}

function parseErrors(transaction: any): ErrorSchema[] {
  const errors: ErrorSchema[] = [];

  if (!transaction?.content) {
    return errors;
  }

  for (const item of transaction.content) {
    if (item.element === 'httpResponse') {
      const statusCode = parseInt(item.attributes?.statusCode?.content || '200');

      // Only include error responses (4xx and 5xx)
      if (statusCode >= 400) {
        const description = item.meta?.title?.content || `Error ${statusCode}`;

        let schema: SchemaType | undefined;
        const asset = item.content?.find((c: any) => c.element === 'asset');
        if (asset?.content) {
          try {
            const parsed = JSON.parse(asset.content);
            schema = inferSchemaFromValue(parsed);
          } catch {
            schema = { type: 'object' };
          }
        }

        errors.push({
          statusCode,
          description,
          schema,
        });
      }
    }
  }

  return errors;
}

function detectAuth(ast: any): AuthConfig {
  // Convert AST to string for pattern matching
  const astString = JSON.stringify(ast);

  // Look for common authentication patterns
  if (astString.includes('Authorization') || astString.includes('bearer')) {
    return {
      type: 'bearer',
      location: 'header',
      name: 'Authorization',
      description: 'Bearer token authentication',
    };
  }

  if (astString.includes('api-key') || astString.includes('apiKey') || astString.includes('X-API-Key')) {
    return {
      type: 'api-key',
      location: 'header',
      name: 'X-API-Key',
      description: 'API key authentication',
    };
  }

  if (astString.includes('oauth') || astString.includes('OAuth')) {
    return {
      type: 'oauth',
      description: 'OAuth 2.0 authentication',
    };
  }

  if (astString.includes('Basic')) {
    return {
      type: 'basic',
      description: 'Basic authentication',
    };
  }

  return {
    type: 'none',
  };
}

function mapTypeToSchemaType(element: string): SchemaType {
  switch (element) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'array':
      return { type: 'array', items: { type: 'object' } };
    case 'object':
      return { type: 'object' };
    default:
      return { type: 'string' };
  }
}

function inferSchemaFromValue(value: any): SchemaType {
  if (Array.isArray(value)) {
    const itemSchema = value.length > 0 ? inferSchemaFromValue(value[0]) : { type: 'object' as const };
    return {
      type: 'array',
      items: itemSchema,
    };
  }

  if (typeof value === 'object' && value !== null) {
    const properties: Record<string, SchemaType> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferSchemaFromValue(val);
      required.push(key);
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  if (typeof value === 'string') {
    return { type: 'string' };
  }

  if (typeof value === 'number') {
    return { type: 'number' };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  return { type: 'object' };
}
