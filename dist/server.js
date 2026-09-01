/**
 * Agent Registry Server
 *
 * HTTP API for agent registration and discovery.
 * Designed to work alongside technocore.chat.
 */
import { createServer } from 'http';
import { RegistryDatabase } from './database.js';
const PORT = parseInt(process.env.REGISTRY_PORT || '3000', 10);
const DB_PATH = process.env.REGISTRY_DB_PATH || `${process.env.HOME}/.technocore-registry/registry.db`;
const db = new RegistryDatabase(DB_PATH);
/**
 * Parse JSON body from request
 */
async function parseBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            }
            catch (e) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}
/**
 * Send JSON response
 */
function sendJson(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
}
/**
 * Handle HTTP requests
 */
async function handleRequest(req, res) {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method;
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    try {
        // Health check
        if (path === '/health' && method === 'GET') {
            sendJson(res, 200, { status: 'ok', agents: db.count() });
            return;
        }
        // Register agent
        if (path === '/register' && method === 'POST') {
            const body = await parseBody(req);
            if (!body.name || !body.did) {
                sendJson(res, 400, { error: 'name and did are required' });
                return;
            }
            const agent = db.register({
                name: body.name,
                did: body.did,
                capabilities: body.capabilities || [],
                endpoints: body.endpoints || {},
                description: body.description || '',
                version: body.version || '0.0.0',
                homepage: body.homepage,
                repository: body.repository,
            });
            sendJson(res, 201, agent);
            return;
        }
        // List all agents
        if (path === '/agents' && method === 'GET') {
            const capability = url.searchParams.get('capability');
            const limit = parseInt(url.searchParams.get('limit') || '100', 10);
            const offset = parseInt(url.searchParams.get('offset') || '0', 10);
            let agents;
            if (capability) {
                agents = db.searchByCapability(capability);
            }
            else {
                agents = db.list(limit, offset);
            }
            sendJson(res, 200, {
                count: agents.length,
                total: db.count(),
                agents,
            });
            return;
        }
        // Get agent by name
        const agentMatch = path.match(/^\/agents\/(.+)$/);
        if (agentMatch && method === 'GET') {
            const name = agentMatch[1];
            const agent = db.get(name);
            if (!agent) {
                sendJson(res, 404, { error: 'Agent not found' });
                return;
            }
            sendJson(res, 200, agent);
            return;
        }
        // Delete agent
        if (agentMatch && method === 'DELETE') {
            const name = agentMatch[1];
            const deleted = db.delete(name);
            if (!deleted) {
                sendJson(res, 404, { error: 'Agent not found' });
                return;
            }
            sendJson(res, 200, { deleted: true });
            return;
        }
        // Search by name
        if (path === '/search' && method === 'GET') {
            const q = url.searchParams.get('q');
            if (!q) {
                sendJson(res, 400, { error: 'q parameter is required' });
                return;
            }
            const agents = db.searchByName(q);
            sendJson(res, 200, {
                count: agents.length,
                agents,
            });
            return;
        }
        // 404
        sendJson(res, 404, { error: 'Not found' });
    }
    catch (err) {
        console.error('Request error:', err);
        sendJson(res, 500, { error: 'Internal server error' });
    }
}
/**
 * Start the server
 */
function main() {
    const server = createServer(handleRequest);
    server.listen(PORT, () => {
        console.log(`🤖 Agent Registry running on http://localhost:${PORT}`);
        console.log(`📁 Database: ${DB_PATH}`);
        console.log(`\nEndpoints:`);
        console.log(`  GET  /health           - Health check`);
        console.log(`  POST /register         - Register an agent`);
        console.log(`  GET  /agents           - List all agents`);
        console.log(`  GET  /agents/:name     - Get agent by name`);
        console.log(`  DELETE /agents/:name   - Delete agent`);
        console.log(`  GET  /search?q=...     - Search by name`);
        console.log(`  GET  /agents?capability=X - Search by capability`);
    });
}
main();
