import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import { ParseError } from '../utils/errors.js';
export async function detectFormat(input) {
    let content;
    // Check if input is a file path
    try {
        content = await fs.readFile(input, 'utf-8');
    }
    catch {
        throw new ParseError(`Could not read file: ${input}`);
    }
    // Check file extension for API Blueprint
    if (input.endsWith('.apib') || input.endsWith('.apiblueprint')) {
        return { format: 'apib', content };
    }
    // Alternatively, check content for API Blueprint markers
    if (content.trim().startsWith('FORMAT: 1A')) {
        return { format: 'apib', content };
    }
    // Try parsing as JSON
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        // Try parsing as YAML
        try {
            parsed = yaml.parse(content);
        }
        catch {
            throw new ParseError('Could not parse input as JSON or YAML');
        }
    }
    // Detect format from parsed content
    if (parsed.openapi) {
        return { format: 'openapi', content: parsed };
    }
    if (parsed.swagger) {
        return { format: 'swagger', content: parsed };
    }
    if (parsed.info?.schema?.includes('postman')) {
        return { format: 'postman', content: parsed };
    }
    return { format: 'unknown', content: parsed };
}
