export type InputFormat = 'openapi' | 'swagger' | 'postman' | 'apib' | 'unknown';
export interface DetectionResult {
    format: InputFormat;
    content: any;
}
export declare function detectFormat(input: string): Promise<DetectionResult>;
