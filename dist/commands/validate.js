import { detectFormat } from '../parsers/detector.js';
import { parseOpenAPI } from '../parsers/openapi.js';
import { logger } from '../utils/logger.js';
export async function validateCommand(input) {
    try {
        logger.info(`Validating: ${input}`);
        const detection = await detectFormat(input);
        logger.success(`Format detected: ${detection.format}`);
        if (detection.format === 'openapi' || detection.format === 'swagger') {
            const schema = parseOpenAPI(detection.content);
            logger.success(`Valid API specification: ${schema.name}`);
            logger.info(`Base URL: ${schema.baseUrl}`);
            logger.info(`Endpoints: ${schema.endpoints.length}`);
            logger.info(`Auth type: ${schema.auth.type}`);
        }
        else {
            logger.warn('Format detected but parsing not implemented yet');
        }
    }
    catch (error) {
        if (error instanceof Error) {
            logger.error(`Validation failed: ${error.message}`);
            process.exit(1);
        }
        throw error;
    }
}
