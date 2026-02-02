/**
 * Parse OpenAPI 3.x or Swagger 2.0 specification into unified APISchema
 */
export function parseOpenAPI(spec) {
    const isSwagger2 = spec.swagger === '2.0';
    const isOpenAPI3 = spec.openapi?.startsWith('3.');
    if (!isSwagger2 && !isOpenAPI3) {
        throw new Error('Unsupported spec version. Only OpenAPI 3.x and Swagger 2.0 are supported.');
    }
    return {
        name: spec.info.title || 'API',
        baseUrl: getBaseUrl(spec),
        auth: detectAuth(spec),
        endpoints: parseEndpoints(spec),
    };
}
/**
 * Extract base URL from spec
 */
function getBaseUrl(spec) {
    // OpenAPI 3.x
    if (spec.servers && spec.servers.length > 0) {
        return spec.servers[0].url;
    }
    // Swagger 2.0
    if (spec.host) {
        const scheme = spec.schemes?.[0] || 'https';
        const basePath = spec.basePath || '';
        return `${scheme}://${spec.host}${basePath}`;
    }
    return '';
}
/**
 * Detect authentication configuration
 */
function detectAuth(spec) {
    const securitySchemes = spec.components?.securitySchemes || spec.securityDefinitions || {};
    const firstScheme = Object.values(securitySchemes)[0];
    if (!firstScheme) {
        return { type: 'none' };
    }
    switch (firstScheme.type) {
        case 'apiKey':
            return {
                type: 'api-key',
                location: firstScheme.in === 'header' ? 'header' : 'query',
                name: firstScheme.name,
                description: firstScheme.description,
            };
        case 'http':
            if (firstScheme.scheme === 'bearer') {
                return { type: 'bearer', description: firstScheme.description };
            }
            if (firstScheme.scheme === 'basic') {
                return { type: 'basic', description: firstScheme.description };
            }
            return { type: 'none' };
        case 'oauth2':
            return { type: 'oauth', description: firstScheme.description };
        default:
            return { type: 'none' };
    }
}
/**
 * Parse all endpoints from spec
 */
function parseEndpoints(spec) {
    const endpoints = [];
    const paths = spec.paths || {};
    for (const [path, pathItem] of Object.entries(paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
        for (const method of methods) {
            const operation = pathItem[method];
            if (operation) {
                endpoints.push(parseOperation(path, method, operation, pathItem));
            }
        }
    }
    return endpoints;
}
/**
 * Parse a single operation into an Endpoint
 */
function parseOperation(path, method, operation, pathItem) {
    const parameters = [];
    // Parse path-level parameters
    if (pathItem.parameters) {
        parameters.push(...parseParameters(pathItem.parameters));
    }
    // Parse operation-level parameters
    if (operation.parameters) {
        parameters.push(...parseParameters(operation.parameters));
    }
    // Parse request body (OpenAPI 3.x)
    let requestBody;
    if (operation.requestBody) {
        const content = operation.requestBody.content || {};
        const jsonContent = content['application/json'];
        if (jsonContent?.schema) {
            requestBody = {
                description: operation.requestBody.description || '',
                required: operation.requestBody.required || false,
                contentType: 'application/json',
                schema: parseSchema(jsonContent.schema),
            };
        }
    }
    // Parse response (use first successful response)
    const responses = operation.responses || {};
    const successCode = Object.keys(responses).find(code => code.startsWith('2')) || '200';
    const successResponse = responses[successCode] || {};
    const responseContent = successResponse.content?.['application/json'];
    const response = {
        statusCode: parseInt(successCode),
        description: successResponse.description || '',
        contentType: 'application/json',
        schema: responseContent?.schema ? parseSchema(responseContent.schema) : { type: 'object' },
    };
    // Parse error responses
    const errors = [];
    for (const [code, resp] of Object.entries(responses)) {
        if (!code.startsWith('2') && code !== 'default') {
            const errorResp = resp;
            const errorContent = errorResp.content?.['application/json'];
            errors.push({
                statusCode: parseInt(code),
                description: errorResp.description || `Error ${code}`,
                schema: errorContent?.schema ? parseSchema(errorContent.schema) : undefined,
            });
        }
    }
    return {
        id: operation.operationId || `${method}_${path.replace(/\//g, '_')}`,
        method: method.toUpperCase(),
        path,
        description: operation.description || operation.summary || '',
        parameters,
        requestBody,
        response,
        errors,
    };
}
/**
 * Parse parameters array
 */
function parseParameters(params) {
    return params.map((param) => {
        // Handle $ref
        if (param.$ref) {
            // For simplicity, we'll skip resolving refs
            return null;
        }
        // Only parse path, query, and header parameters (not body)
        if (!['path', 'query', 'header'].includes(param.in)) {
            return null;
        }
        const schema = param.schema || { type: param.type };
        return {
            name: param.name,
            in: param.in,
            required: param.required || false,
            description: param.description || '',
            schema: parseSchema(schema),
        };
    }).filter(Boolean);
}
/**
 * Parse JSON Schema into SchemaType
 */
function parseSchema(schema) {
    if (!schema) {
        return { type: 'string' };
    }
    // Handle basic types
    if (schema.type === 'object' || schema.properties) {
        const properties = {};
        const required = schema.required || [];
        for (const [key, value] of Object.entries(schema.properties || {})) {
            properties[key] = parseSchema(value);
        }
        return {
            type: 'object',
            properties,
            required,
        };
    }
    if (schema.type === 'array') {
        return {
            type: 'array',
            items: parseSchema(schema.items),
        };
    }
    // Enum
    if (schema.enum) {
        return {
            type: schema.type || 'string',
            enum: schema.enum,
        };
    }
    // Basic types with format
    return {
        type: schema.type || 'string',
        format: schema.format,
    };
}
