import { APISchema, DetectedPatterns } from '../schema/api-schema.js';
export declare function generateServer(schema: APISchema, patterns: DetectedPatterns, outputDir: string): Promise<void>;
