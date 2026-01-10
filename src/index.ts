#!/usr/bin/env node
/**
 * Entry point for gemini-research-mcp (stdio mode)
 * Connects to MCP clients via stdin/stdout (e.g., Claude Desktop)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, setupShutdownHandlers } from './server.js';
import { debugLog, progressLog, warnLog, errorLog, config } from './config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Ensure the config directory and Gemini CLI settings exist
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
      // IMPORTANT: We substitute actual values at generation time, not placeholders
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
