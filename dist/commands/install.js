import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getServer } from '../registry/manager.js';
import { logger } from '../utils/logger.js';
export async function installCommand(serverName) {
    try {
        // Get server from registry
        const server = await getServer(serverName);
        if (!server) {
            logger.error(`Server not found: ${serverName}`);
            logger.info('Run "mcp-factory list" to see available servers');
            process.exit(1);
        }
        // Check if server build exists
        const buildPath = path.join(server.path, 'build', 'index.js');
        try {
            await fs.access(buildPath);
        }
        catch {
            logger.error(`Server not built yet. Run:`);
            logger.info(`  cd ${server.path}`);
            logger.info(`  npm install && npm run build`);
            process.exit(1);
        }
        // Determine Claude config paths
        const configPaths = [
            path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
            path.join(os.homedir(), '.claude', 'config.json'),
        ];
        let installed = false;
        for (const configPath of configPaths) {
            try {
                await fs.access(configPath);
                await installToConfig(configPath, serverName, buildPath);
                installed = true;
                const configName = configPath.includes('claude_desktop_config.json')
                    ? 'Claude Desktop'
                    : 'Claude Code';
                logger.success(`Installed ${serverName} to ${configName}`);
            }
            catch {
                // Config file doesn't exist, skip
            }
        }
        if (!installed) {
            logger.warn('No Claude configuration files found');
            logger.info('Expected locations:');
            configPaths.forEach(p => logger.info(`  ${p}`));
        }
        else {
            logger.info('\nNext steps:');
            logger.info('  1. Edit the config file and add your API credentials');
            logger.info('  2. Restart Claude Desktop/Code to load the server');
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
async function installToConfig(configPath, serverName, buildPath) {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (!config.mcpServers) {
        config.mcpServers = {};
    }
    config.mcpServers[serverName] = {
        command: 'node',
        args: [buildPath],
        env: {
            API_KEY: 'YOUR_API_KEY_HERE',
        },
    };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
