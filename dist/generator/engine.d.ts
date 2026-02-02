import { APISchema, DetectedPatterns } from '../schema/api-schema.js';
export interface GenerationContext {
    name: string;
    baseUrl: string;
    auth: any;
    endpoints: any[];
    patterns: DetectedPatterns;
    absolutePath?: string;
}
export declare function generateServer(schema: APISchema, patterns: DetectedPatterns, outputDir: string): Promise<void>;
