export declare class MCPFactoryError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class ParseError extends MCPFactoryError {
    constructor(message: string);
}
export declare class ValidationError extends MCPFactoryError {
    constructor(message: string);
}
export declare class GenerationError extends MCPFactoryError {
    constructor(message: string);
}
