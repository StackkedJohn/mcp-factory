export class MCPFactoryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MCPFactoryError';
  }
}

export class ParseError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
  }
}

export class ValidationError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class GenerationError extends MCPFactoryError {
  constructor(message: string) {
    super(message, 'GENERATION_ERROR');
    this.name = 'GenerationError';
  }
}
