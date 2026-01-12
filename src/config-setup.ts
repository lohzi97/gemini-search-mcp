/**
 * Shared configuration setup functionality
 * Used by both stdio (index.ts) and HTTP (http.ts) entry points
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config, debugLog, errorLog } from './config.js';

// Get the directory name of the current module for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensure the config directory and Gemini CLI settings exist
 * This function:
 * 1. Creates the config directory if it doesn't exist
 * 2. Creates the .gemini subdirectory if it doesn't exist
 * 3. Generates settings.json from template if it doesn't exist
 *
 * The template path is resolved relative to the built file location,
 * which supports both local development and global npm installations.
 */
export async function ensureConfigSetup(): Promise<void> {
  const { configDir, geminiSettingsPath, firecrawlApiKey, firecrawlApiUrl } = config;

  debugLog(`Ensuring config directory exists: ${configDir}`);

  // Check if Firecrawl credentials are provided
  const hasFirecrawlConfig = !!(firecrawlApiKey || firecrawlApiUrl);
  debugLog(`Firecrawl MCP ${hasFirecrawlConfig ? 'enabled' : 'disabled (no credentials provided)'}`);

  try {
    // Create config directory if it doesn't exist
    await fs.mkdir(configDir, { recursive: true });

    const geminiDir = path.join(configDir, '.gemini');
    await fs.mkdir(geminiDir, { recursive: true });

    // Check if settings.json exists and whether it needs regeneration
    let settingsExists = await fs
      .access(geminiSettingsPath)
      .then(() => true)
      .catch(() => false);

    // Check if existing settings match current Firecrawl config
    let needsRegeneration = !settingsExists;
    if (settingsExists) {
      try {
        const existingContent = await fs.readFile(geminiSettingsPath, 'utf-8');
        const existing = JSON.parse(existingContent);
        const hasFirecrawlInSettings = !!(existing.mcpServers?.firecrawl);
        if (hasFirecrawlInSettings !== hasFirecrawlConfig) {
          debugLog('Firecrawl configuration changed, regenerating settings.json');
          needsRegeneration = true;
        }
      } catch {
        // If we can't read the existing settings, regenerate
        debugLog('Could not read existing settings, regenerating');
        needsRegeneration = true;
      }
    }

    if (needsRegeneration) {
      debugLog('Gemini CLI settings.json not found, generating from template');

      // Build the settings based on whether Firecrawl is configured
      const settings: Record<string, unknown> = {};

      if (hasFirecrawlConfig) {
        settings.mcpServers = {
          firecrawl: {
            command: 'npx',
            args: ['-y', 'firecrawl-mcp'],
            env: {
              FIRECRAWL_API_KEY: firecrawlApiKey,
              FIRECRAWL_API_URL: firecrawlApiUrl,
              HTTP_STREAMABLE_SERVER: 'true',
            },
          },
        };
        debugLog('Firecrawl MCP server configuration included');
      } else {
        // Empty mcpServers or no mcpServers at all
        settings.mcpServers = {};
        debugLog('Firecrawl MCP server configuration skipped (no credentials)');
      }

      // Try to read and use template if it exists
      const templatePath = path.join(__dirname, '..', 'templates', 'gemini-settings.json.template');
      let settingsContent: string;

      try {
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        // Substitute environment variables in template
        settingsContent = templateContent
          .replace(/\{\{FIRECRAWL_API_KEY\}\}/g, firecrawlApiKey)
          .replace(/\{\{FIRECRAWL_API_URL\}\}/g, firecrawlApiUrl);

        // If no Firecrawl config, remove the firecrawl server from the template
        if (!hasFirecrawlConfig) {
          const parsed = JSON.parse(settingsContent);
          if (parsed.mcpServers?.firecrawl) {
            delete parsed.mcpServers.firecrawl;
            // If mcpServers is now empty, remove it entirely
            if (Object.keys(parsed.mcpServers).length === 0) {
              delete parsed.mcpServers;
            }
            settingsContent = JSON.stringify(parsed, null, 2);
          }
        }
      } catch {
        // If template doesn't exist, use the settings object we built
        debugLog('Template not found, using default settings');
        settingsContent = JSON.stringify(settings, null, 2);
      }

      // Write the settings file
      await fs.writeFile(geminiSettingsPath, settingsContent, 'utf-8');
      debugLog(`Generated Gemini CLI settings at: ${geminiSettingsPath}`);
    } else {
      debugLog('Gemini CLI settings.json already exists, using existing configuration');
    }
  } catch (err) {
    const error = err as Error;
    errorLog(`Failed to create config directory: ${error.message}`);
    console.error(
      `[ERROR] Failed to create config directory at ${configDir}. Please check permissions and try again.`
    );
    process.exit(1);
  }
}
