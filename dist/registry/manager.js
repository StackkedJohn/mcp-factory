import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
const REGISTRY_DIR = path.join(os.homedir(), '.mcp-factory');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');
async function ensureRegistry() {
    try {
        await fs.access(REGISTRY_FILE);
    }
    catch {
        await fs.mkdir(REGISTRY_DIR, { recursive: true });
        await fs.writeFile(REGISTRY_FILE, JSON.stringify({ servers: [] }, null, 2));
    }
}
export async function loadRegistry() {
    await ensureRegistry();
    const content = await fs.readFile(REGISTRY_FILE, 'utf-8');
    return JSON.parse(content);
}
export async function saveRegistry(registry) {
    await ensureRegistry();
    await fs.writeFile(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}
export async function addServer(name, serverPath) {
    const registry = await loadRegistry();
    // Remove existing entry if present
    registry.servers = registry.servers.filter(s => s.name !== name);
    // Add new entry
    registry.servers.push({
        name,
        path: path.resolve(serverPath),
        createdAt: new Date().toISOString(),
    });
    await saveRegistry(registry);
}
export async function getServer(name) {
    const registry = await loadRegistry();
    return registry.servers.find(s => s.name === name);
}
export async function listServers() {
    const registry = await loadRegistry();
    return registry.servers;
}
