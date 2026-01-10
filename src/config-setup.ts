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
      // Resolve path relative to the built file location (supports global npm installs)
      const templatePath = path.join(__dirname, '..', 'templates', 'gemini-settings.json.template');
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
  } catch (err) {
    const error = err as Error;
    errorLog(`Failed to create config directory: ${error.message}`);
    console.error(
      `[ERROR] Failed to create config directory at ${configDir}. Please check permissions and try again.`
    );
    process.exit(1);
  }
}
