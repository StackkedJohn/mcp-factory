export class MCPFactoryError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'MCPFactoryError';
    }
}
export class ParseError extends MCPFactoryError {
    constructor(message) {
        super(message, 'PARSE_ERROR');
        this.name = 'ParseError';
    }
}
export class ValidationError extends MCPFactoryError {
    constructor(message) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}
export class GenerationError extends MCPFactoryError {
    constructor(message) {
        super(message, 'GENERATION_ERROR');
        this.name = 'GenerationError';
    }
}
