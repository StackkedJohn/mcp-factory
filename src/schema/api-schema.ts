export interface APISchema {
  name: string;
  baseUrl: string;
  auth: AuthConfig;
  endpoints: Endpoint[];
  commonHeaders?: Record<string, string>;
  rateLimit?: RateLimitConfig;
  pagination?: PaginationConfig;
}

export interface AuthConfig {
  type: 'api-key' | 'bearer' | 'oauth' | 'basic' | 'none';
  location?: 'header' | 'query';
  name?: string;
  description?: string;
}

export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  response: ResponseSchema;
  errors: ErrorSchema[];
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  description?: string;
  required: boolean;
  schema: SchemaType;
}

export interface RequestBody {
  description?: string;
  required: boolean;
  contentType: string;
  schema: SchemaType;
}

export interface ResponseSchema {
  statusCode: number;
  description?: string;
  contentType: string;
  schema: SchemaType;
}

export interface ErrorSchema {
  statusCode: number;
  description: string;
  schema?: SchemaType;
}

export interface SchemaType {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  properties?: Record<string, SchemaType>;
  items?: SchemaType;
  required?: string[];
  enum?: string[];
  format?: string;
}

export interface RateLimitConfig {
  strategy: 'header-based' | 'retry-after' | 'none';
  headerName?: string;
  requestsPerWindow?: number;
  windowSeconds?: number;
}

export interface PaginationConfig {
  style: 'cursor' | 'offset' | 'page' | 'link-header';
  cursorParam?: string;
  limitParam?: string;
  offsetParam?: string;
  pageParam?: string;
}

export interface DetectedPatterns {
  authPattern: 'api-key' | 'bearer' | 'oauth' | 'basic' | 'none';
  paginationStyle?: 'cursor' | 'offset' | 'page' | 'link-header';
  rateLimitStrategy?: 'header-based' | 'retry-after' | 'none';
  errorFormat: 'standard' | 'custom';
  hasWebhooks: boolean;
}
