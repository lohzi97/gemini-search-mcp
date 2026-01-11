#!/usr/bin/env node
/**
 * Entry point for gemini-search-mcp-http (HTTP mode)
 * Connects to MCP clients via HTTP (e.g., remote clients)
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
import { debugLog, progressLog, errorLog, config } from './config.js';
import { ensureConfigSetup } from './config-setup.js';

/**
 * Main entry point for HTTP mode
 */
async function main(): Promise<void> {
  debugLog('Starting gemini-search-mcp in HTTP mode');
  debugLog(`Config directory: ${config.configDir}`);
  debugLog(`Gemini model: ${config.geminiModel}`);
  debugLog(`HTTP server: ${config.mcpServerHost}:${config.mcpServerPort}`);

  // Ensure config is set up
  await ensureConfigSetup();

  // Create Express app
  const app = express();
  app.use(express.json());

  // Create the MCP server
  const server = createServer();

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'gemini-search-mcp',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Setup MCP endpoint handler
  app.post('/mcp', async (req, res) => {
    debugLog('Received HTTP request');

    // Create a new transport for each request (stateless)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode - no session tracking
      enableJsonResponse: true,
    });

    // Clean up transport when response closes
    res.on('close', () => {
      debugLog('HTTP response closed, cleaning up transport');
      transport.close();
    });

    try {
      // Connect server to transport
      await server.connect(transport);

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const err = error as Error;
      errorLog(`Error handling HTTP request: ${err.message}`);

      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: err.message,
          },
        });
      }
    }
  });

  // Start HTTP server
  const httpServer = app.listen(config.mcpServerPort, config.mcpServerHost, () => {
    const mcpUrl = `http://${config.mcpServerHost}:${config.mcpServerPort}/mcp`;
    const healthUrl = `http://${config.mcpServerHost}:${config.mcpServerPort}/health`;
    progressLog(`MCP HTTP server listening on ${mcpUrl}`);
    progressLog(`Health check available at ${healthUrl}`);
    debugLog(`HTTP server ready for connections`);
  });

  // Handle graceful shutdown - close both MCP server and HTTP server
  const shutdown = async (signal: string) => {
    debugLog(`Received ${signal}, shutting down gracefully`);

    try {
      // Close MCP server first
      await server.close();
      debugLog('MCP server closed');
    } catch (error) {
      errorLog(`Error closing MCP server: ${error}`);
    }

    // Close HTTP server
    httpServer.close(() => {
      debugLog('HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      debugLog('Force closing HTTP server');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the server
main().catch((error) => {
  errorLog(`Fatal error: ${error}`);
  process.exit(1);
});
