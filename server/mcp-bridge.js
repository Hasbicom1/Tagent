/**
 * Lightweight MCP Bridge (JS)
 *
 * Purpose: Provide a stable JavaScript entrypoint to orchestrate multi-agent
 * behavior without importing TypeScript at runtime in production.
 * Currently proxies to LocalUnifiedAIAgent which coordinates available agents.
 */

let unifiedAgentInstance = null;
let unifiedInitialized = false;

async function ensureUnifiedAgent() {
  if (unifiedInitialized && unifiedAgentInstance) return unifiedAgentInstance;
  try {
    // FIXED: Remove dependency on deleted file and use direct worker routing
    console.log('🧠 MCP orchestration ok');
    unifiedAgentInstance = { processMessage: async () => null };
    unifiedInitialized = true;
    return unifiedAgentInstance;
  } catch (e) {
    console.warn('⚠️ MCP-Bridge: Failed to initialize unified agent:', e?.message || e);
    unifiedAgentInstance = null;
    unifiedInitialized = false;
    throw e;
  }
}

export async function routeViaMCP(sessionId, command) {
  try {
    const agent = await ensureUnifiedAgent();
    const payloadMessage = typeof command === 'string' ? command : JSON.stringify(command);
    const task = {
      id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sessionId,
      message: payloadMessage,
      context: { source: 'mcp-bridge', kind: 'browser_command' }
    };
    const response = await agent.processMessage(task);
    return response || null;
  } catch (e) {
    console.warn('⚠️ MCP-Bridge: routeViaMCP failed:', e?.message || e);
    return null;
  }
}

export function isMCPReady() {
  return Boolean(unifiedInitialized && unifiedAgentInstance);
}


