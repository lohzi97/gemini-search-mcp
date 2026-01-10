#!/usr/bin/env node
/**
 * Entry point for gemini-research-mcp-http (HTTP mode)
 * Connects to MCP clients via HTTP (e.g., remote clients)
 */

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer, setupShutdownHandlers } from './server.js';
import { debugLog, progressLog, errorLog, config } from './config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Ensure the config directory and Gemini CLI settings exist
 * (Copied from index.ts - could be refactored to a shared module)
 */
async function ensureConfigSetup(): Promise<void> {
  const { configDir, geminiSettingsPath } = config;

  debugLog(`Ensuring config directory exists: ${configDir}`);

  try {
    // Create config directory if it doesn't exist
    await fs.mkdir(configDir, { recursive: true });

    const geminiDir = path.join(configDir, '.gemini');
    await fs.mkdir(geminiDir, { recursive: true });

    // Check if settings.json exists
    const settingsExists = await fs
      .access(geminiSettingsPath)
      .then(() => true)
      .catch(() => false);

    if (!settingsExists) {
      debugLog('Gemini CLI settings.json not found, generating from template');

      // Read the template
      const templatePath = path.join(process.cwd(), 'templates', 'gemini-settings.json.template');
      let templateContent: string;

      try {
        templateContent = await fs.readFile(templatePath, 'utf-8');
      } catch {
        // If template doesn't exist, use default
        debugLog('Template not found, using default settings');
        templateContent = JSON.stringify(
          {
            mcpServers: {
              firecrawl: {
                command: 'npx',
                args: ['-y', 'firecrawl-mcp'],
                env: {
                  FIRECRAWL_API_KEY: '{{FIRECRAWL_API_KEY}}',
                  FIRECRAWL_API_URL: '{{FIRECRAWL_API_URL}}',
                  HTTP_STREAMABLE_SERVER: 'true',
                },
              },
            },
          },
          null,
          2
        );
      }

      // Substitute environment variables
      let settingsContent = templateContent
        .replace(/\{\{FIRECRAWL_API_KEY\}\}/g, config.firecrawlApiKey)
        .replace(/\{\{FIRECRAWL_API_URL\}\}/g, config.firecrawlApiUrl);

      // Write the settings file
      await fs.writeFile(geminiSettingsPath, settingsContent, 'utf-8');
      debugLog(`Generated Gemini CLI settings at: ${geminiSettingsPath}`);
    } else {
      debugLog('Gemini CLI settings.json already exists, using existing configuration');
    }
  } catch (error) {
    const err = error as Error;
    errorLog(`Failed to create config directory: ${err.message}`);
    console.error(
      `[ERROR] Failed to create config directory at ${configDir}. Please check permissions and try again.`
    );
    process.exit(1);
  }
}

/**
 * Main entry point for HTTP mode
 */
async function main(): Promise<void> {
  debugLog('Starting gemini-research-mcp in HTTP mode');
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

  // Set up shutdown handlers
  setupShutdownHandlers(server);

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
    const url = `http://${config.mcpServerHost}:${config.mcpServerPort}/mcp`;
    progressLog(`MCP HTTP server listening on ${url}`);
    debugLog(`HTTP server ready for connections`);
  });

  // Handle HTTP server shutdown
  const shutdown = async (signal: string) => {
    debugLog(`Received ${signal}, shutting down HTTP server`);
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
