#!/usr/bin/env node
/**
 * Entry point for gemini-search-mcp (stdio mode)
 * Connects to MCP clients via stdin/stdout (e.g., Claude Desktop)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, setupShutdownHandlers } from './server.js';
import { cleanupOrphanedTempFiles } from './utils.js';
import { debugLog, progressLog, errorLog, config } from './config.js';
import { ensureConfigSetup } from './config-setup.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Display help/usage information
 */
function showHelp(): void {
  console.error(`
gemini-search-mcp - MCP Server for Gemini-powered Web Search

DESCRIPTION:
  An MCP (Model Context Protocol) server that orchestrates Google Gemini CLI
  for web search with JavaScript rendering via Firecrawl.

USAGE:
  gemini-search-mcp

OPTIONS:
  --help, -h     Show this help message
  --version, -v  Show version information

ENVIRONMENT VARIABLES:
  GEMINI_MODEL        Model to use (optional, auto-selects if not set)
  GEMINI_SEARCH_TIMEOUT  Max search duration in ms (default: 300000)
  FIRECRAWL_API_KEY   API key for Firecrawl (optional, enables JS rendering)
  DEBUG               Enable verbose logging (set to "true")

CONFIG:
  On first run, creates config at:
    Linux:   ~/.config/gemini-search-mcp/.gemini/settings.json
    macOS:   ~/Library/Application Support/gemini-search-mcp/.gemini/settings.json
    Windows: %APPDATA%\\gemini-search-mcp\\.gemini\\settings.json

EXAMPLES:
  # Start server (for use with Claude Desktop or other MCP clients)
  gemini-search-mcp

  # Enable debug logging
  DEBUG=true gemini-search-mcp

  # Use specific Gemini model (optional - auto-selects if not set)
  GEMINI_MODEL=gemini-2.5-pro gemini-search-mcp
`);
}

/**
 * Display version information
 */
function showVersion(): void {
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'package.json'),
      'utf-8'
    )
  );
  console.error(`gemini-search-mcp v${pkg.version}`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Handle CLI arguments
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  debugLog('Starting gemini-search-mcp in stdio mode');
  debugLog(`Config directory: ${config.configDir}`);
  debugLog(`Gemini model: ${config.geminiModel || 'auto-select'}`);

  // Ensure config is set up
  await ensureConfigSetup();

  // Clean up any orphaned temp files from previous crashes
  await cleanupOrphanedTempFiles();

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
