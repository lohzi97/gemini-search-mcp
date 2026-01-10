#!/usr/bin/env node
/**
 * Entry point for gemini-research-mcp (stdio mode)
 * Connects to MCP clients via stdin/stdout (e.g., Claude Desktop)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, setupShutdownHandlers } from './server.js';
import { debugLog, progressLog, errorLog, config } from './config.js';
import { ensureConfigSetup } from './config-setup.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  debugLog('Starting gemini-research-mcp in stdio mode');
  debugLog(`Config directory: ${config.configDir}`);
  debugLog(`Gemini model: ${config.geminiModel}`);

  // Ensure config is set up
  await ensureConfigSetup();

  // Create the MCP server
  const server = createServer();

  // Set up shutdown handlers
  setupShutdownHandlers(server);

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  progressLog('MCP server running on stdio');
}

// Start the server
main().catch((error) => {
  errorLog(`Fatal error: ${error}`);
  process.exit(1);
});
