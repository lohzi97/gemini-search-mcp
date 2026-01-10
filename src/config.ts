/**
 * Configuration and environment variable handling for Gemini Research MCP
 */

import * as os from 'os';
import * as path from 'path';

// Load environment variables from .env file if present
import 'dotenv/config';

/**
 * Get the platform-appropriate config directory
 */
export function getConfigDir(): string {
  const envOverride = process.env.GEMINI_RESEARCH_CONFIG_DIR;
  if (envOverride) {
    return envOverride;
  }

  const platform = os.platform();
  const baseDir =
    platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : platform === 'win32'
        ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
        : path.join(os.homedir(), '.config');

  return path.join(baseDir, 'gemini-research-mcp');
}

/**
 * Get the path to the .gemini/settings.json file
 */
export function getGeminiSettingsPath(): string {
  return path.join(getConfigDir(), '.gemini', 'settings.json');
}

/**
 * Configuration object with all environment variables
 */
export const config = {
  // Gemini configuration
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiTimeout: parseInt(process.env.GEMINI_RESEARCH_TIMEOUT || '300000', 10),
  geminiSystemPrompt: process.env.GEMINI_SYSTEM_PROMPT,
  geminiMaxIterations: parseInt(process.env.GEMINI_CLI_MAX_ITERATIONS || '10', 10),

  // Firecrawl configuration
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY || '',
  firecrawlApiUrl: process.env.FIRECRAWL_API_URL || '',

  // JSON parsing configuration
  jsonMaxRetries: parseInt(process.env.JSON_MAX_RETRIES || '3', 10),

  // Debug and logging
  debug: process.env.DEBUG === 'true',
  progressLogInterval: parseInt(process.env.PROGRESS_LOG_INTERVAL || '30000', 10),

  // MCP HTTP server configuration
  mcpServerPort: parseInt(process.env.MCP_SERVER_PORT || '3000', 10),
  mcpServerHost: process.env.MCP_SERVER_HOST || '127.0.0.1',

  // Paths
  configDir: getConfigDir(),
  geminiSettingsPath: getGeminiSettingsPath(),
} as const;

/**
 * Log debug information if DEBUG mode is enabled
 */
export function debugLog(...args: unknown[]): void {
  if (config.debug) {
    console.error('[DEBUG]', ...args);
  }
}

/**
 * Log progress information to stderr
 */
export function progressLog(message: string): void {
  console.error(`[INFO] ${message}`);
}

/**
 * Log warning information to stderr
 */
export function warnLog(message: string): void {
  console.error(`[WARN] ${message}`);
}

/**
 * Log error information to stderr
 */
export function errorLog(message: string): void {
  console.error(`[ERROR] ${message}`);
}
