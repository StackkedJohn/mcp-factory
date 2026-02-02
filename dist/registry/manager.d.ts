export interface RegistryEntry {
    name: string;
    path: string;
    createdAt: string;
}
export interface Registry {
    servers: RegistryEntry[];
}
export declare function loadRegistry(): Promise<Registry>;
export declare function saveRegistry(registry: Registry): Promise<void>;
export declare function addServer(name: string, serverPath: string): Promise<void>;
export declare function getServer(name: string): Promise<RegistryEntry | undefined>;
export declare function listServers(): Promise<RegistryEntry[]>;
