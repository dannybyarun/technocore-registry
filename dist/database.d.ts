/**
 * Agent Registry Database
 *
 * SQLite storage for agent registrations.
 * Supports capability-based search and DID-based identity.
 */
export interface Agent {
    name: string;
    did: string;
    capabilities: string[];
    endpoints: {
        chat?: string;
        room?: string;
        api?: string;
    };
    description: string;
    version: string;
    homepage?: string;
    repository?: string;
    registered_at: string;
    updated_at: string;
}
export declare class RegistryDatabase {
    private db;
    constructor(dbPath: string);
    private init;
    /**
     * Register or update an agent
     */
    register(agent: Omit<Agent, 'registered_at' | 'updated_at'>): Agent;
    /**
     * Get an agent by name
     */
    get(name: string): Agent | null;
    /**
     * Search agents by capability
     */
    searchByCapability(capability: string): Agent[];
    /**
     * List all agents
     */
    list(limit?: number, offset?: number): Agent[];
    /**
     * Delete an agent
     */
    delete(name: string): boolean;
    /**
     * Get total count
     */
    count(): number;
    /**
     * Search by name (fuzzy)
     */
    searchByName(query: string): Agent[];
    private rowToAgent;
    close(): void;
}
