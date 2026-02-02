import { describe, it } from 'node:test';
import assert from 'node:assert';
import { detectFormat } from './detector.js';
import * as fs from 'fs/promises';
import * as path from 'path';
describe('Format Detector', () => {
    it('should detect API Blueprint format from .apib file', async () => {
        // Create temp .apib file
        const tempFile = path.join(process.cwd(), 'test.apib');
        await fs.writeFile(tempFile, 'FORMAT: 1A\n# My API\n## GET /users', 'utf-8');
        try {
            const result = await detectFormat(tempFile);
            assert.strictEqual(result.format, 'apib');
            assert.ok(result.content.includes('FORMAT: 1A'));
        }
        finally {
            await fs.unlink(tempFile);
        }
    });
});
