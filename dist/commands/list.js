import { listServers } from '../registry/manager.js';
import { logger } from '../utils/logger.js';
export async function listCommand() {
    try {
        const servers = await listServers();
        if (servers.length === 0) {
            logger.info('No MCP servers generated yet');
            return;
        }
        logger.info(`Generated MCP servers (${servers.length}):\n`);
        for (const server of servers) {
            console.log(`  ${server.name}`);
            console.log(`    Path: ${server.path}`);
            console.log(`    Created: ${new Date(server.createdAt).toLocaleString()}\n`);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            logger.error(error.message);
            process.exit(1);
        }
        throw error;
    }
}
