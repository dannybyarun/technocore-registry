#!/usr/bin/env node
/**
 * Agent Registry CLI
 *
 * Command-line interface for registering and discovering agents.
 */
import { RegistryDatabase } from './database.js';
const DB_PATH = process.env.REGISTRY_DB_PATH || `${process.env.HOME}/.technocore-registry/registry.db`;
function parseArgs(argv) {
    const args = argv.slice(2);
    const command = args[0] || '';
    const options = {};
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                options[key] = next;
                i++;
            }
            else {
                options[key] = 'true';
            }
        }
    }
    return { command, options };
}
function showHelp() {
    console.log(`
technocore-registry — Agent discovery for technocore.chat

Usage:
  technocore-registry <command> [options]

Commands:
  serve       Start the registry server
  register    Register an agent
  get         Get agent details
  list        List all agents
  search      Search agents
  delete      Delete an agent

Examples:
  technocore-registry serve --port 3000
  technocore-registry register --name weather-bot --did "did:key:z6Mk..." --capabilities weather,forecast
  technocore-registry get --name weather-bot
  technocore-registry list
  technocore-registry search --capability weather
  technocore-registry delete --name weather-bot
`);
}
async function main() {
    const { command, options } = parseArgs(process.argv);
    if (command === 'help' || command === '--help' || !command) {
        showHelp();
        return;
    }
    const db = new RegistryDatabase(DB_PATH);
    try {
        switch (command) {
            case 'serve': {
                // Import and start server dynamically
                const port = options.port || '3000';
                process.env.REGISTRY_PORT = port;
                await import('./server.js');
                break;
            }
            case 'register': {
                const name = options.name;
                const did = options.did;
                const capabilities = (options.capabilities || '').split(',').filter(Boolean);
                const description = options.description || '';
                const version = options.version || '0.1.0';
                const chat = options.chat || 'https://technocore.chat';
                const room = options.room || name;
                if (!name || !did) {
                    console.error('Error: --name and --did are required');
                    process.exit(1);
                }
                const agent = db.register({
                    name,
                    did,
                    capabilities,
                    endpoints: { chat, room },
                    description,
                    version,
                });
                console.log('✅ Agent registered:');
                console.log(JSON.stringify(agent, null, 2));
                break;
            }
            case 'get': {
                const name = options.name;
                if (!name) {
                    console.error('Error: --name is required');
                    process.exit(1);
                }
                const agent = db.get(name);
                if (!agent) {
                    console.error(`Agent not found: ${name}`);
                    process.exit(1);
                }
                console.log(JSON.stringify(agent, null, 2));
                break;
            }
            case 'list': {
                const limit = parseInt(options.limit || '100', 10);
                const agents = db.list(limit);
                console.log(`Found ${agents.length} agents:\n`);
                for (const agent of agents) {
                    console.log(`  ${agent.name} (${agent.version})`);
                    console.log(`    DID: ${agent.did.slice(0, 20)}...`);
                    console.log(`    Capabilities: ${agent.capabilities.join(', ') || 'none'}`);
                    console.log(`    ${agent.description}`);
                    console.log();
                }
                break;
            }
            case 'search': {
                const capability = options.capability;
                const query = options.query;
                let agents;
                if (capability) {
                    agents = db.searchByCapability(capability);
                    console.log(`Agents with capability "${capability}":\n`);
                }
                else if (query) {
                    agents = db.searchByName(query);
                    console.log(`Agents matching "${query}":\n`);
                }
                else {
                    console.error('Error: --capability or --query is required');
                    process.exit(1);
                }
                for (const agent of agents) {
                    console.log(`  ${agent.name}`);
                    console.log(`    ${agent.description}`);
                    console.log(`    Room: ${agent.endpoints.room || 'N/A'}`);
                    console.log();
                }
                break;
            }
            case 'delete': {
                const name = options.name;
                if (!name) {
                    console.error('Error: --name is required');
                    process.exit(1);
                }
                const deleted = db.delete(name);
                if (deleted) {
                    console.log(`✅ Deleted agent: ${name}`);
                }
                else {
                    console.error(`Agent not found: ${name}`);
                    process.exit(1);
                }
                break;
            }
            default:
                console.error(`Unknown command: ${command}`);
                showHelp();
                process.exit(1);
        }
    }
    finally {
        db.close();
    }
}
main();
