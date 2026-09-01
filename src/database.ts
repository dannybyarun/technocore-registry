/**
 * Agent Registry Database
 * 
 * SQLite storage for agent registrations.
 * Supports capability-based search and DID-based identity.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

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

export class RegistryDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    mkdirSync(dirname(dbPath), { recursive: true });
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        name TEXT PRIMARY KEY,
        did TEXT NOT NULL,
        capabilities TEXT NOT NULL,  -- JSON array
        endpoints TEXT NOT NULL,     -- JSON object
        description TEXT,
        version TEXT,
        homepage TEXT,
        repository TEXT,
        registered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_did ON agents(did);
    `);
  }

  /**
   * Register or update an agent
   */
  register(agent: Omit<Agent, 'registered_at' | 'updated_at'>): Agent {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO agents (name, did, capabilities, endpoints, description, version, homepage, repository, registered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        did = excluded.did,
        capabilities = excluded.capabilities,
        endpoints = excluded.endpoints,
        description = excluded.description,
        version = excluded.version,
        homepage = excluded.homepage,
        repository = excluded.repository,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      agent.name,
      agent.did,
      JSON.stringify(agent.capabilities),
      JSON.stringify(agent.endpoints),
      agent.description,
      agent.version,
      agent.homepage || null,
      agent.repository || null,
      now,
      now
    );

    return this.get(agent.name)!;
  }

  /**
   * Get an agent by name
   */
  get(name: string): Agent | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE name = ?').get(name) as any;
    if (!row) return null;
    return this.rowToAgent(row);
  }

  /**
   * Search agents by capability
   */
  searchByCapability(capability: string): Agent[] {
    const rows = this.db.prepare('SELECT * FROM agents').all() as any[];
    return rows
      .map(row => this.rowToAgent(row))
      .filter(agent => agent.capabilities.includes(capability));
  }

  /**
   * List all agents
   */
  list(limit: number = 100, offset: number = 0): Agent[] {
    const rows = this.db.prepare('SELECT * FROM agents LIMIT ? OFFSET ?').all(limit, offset) as any[];
    return rows.map(row => this.rowToAgent(row));
  }

  /**
   * Delete an agent
   */
  delete(name: string): boolean {
    const result = this.db.prepare('DELETE FROM agents WHERE name = ?').run(name);
    return result.changes > 0;
  }

  /**
   * Get total count
   */
  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as any;
    return row.count;
  }

  /**
   * Search by name (fuzzy)
   */
  searchByName(query: string): Agent[] {
    const rows = this.db.prepare('SELECT * FROM agents WHERE name LIKE ?').all(`%${query}%`) as any[];
    return rows.map(row => this.rowToAgent(row));
  }

  private rowToAgent(row: any): Agent {
    return {
      name: row.name,
      did: row.did,
      capabilities: JSON.parse(row.capabilities),
      endpoints: JSON.parse(row.endpoints),
      description: row.description,
      version: row.version,
      homepage: row.homepage,
      repository: row.repository,
      registered_at: row.registered_at,
      updated_at: row.updated_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
