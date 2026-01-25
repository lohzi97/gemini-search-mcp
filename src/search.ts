/**
 * Search tool implementation
 * Single-round search: Google search once → fetch promising sites → return result
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  checkGeminiCli,
  executeResearchWithCorrection,
  SEARCH_SCHEMA,
} from './utils.js';
import { config, debugLog, progressLog, errorLog } from './config.js';

// Get the directory name of the current module for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Search parameters
 */
export interface SearchParams {
  query: string;
}

/**
 * Search result metadata
 */
export interface SearchMetadata {
  duration_ms: number;
  query: string;
  model: string;
  timestamp: string;
  sources_visited?: string[];
  search_queries_used?: string[];
  iterations: number;
}

/**
 * Successful search result
 */
export interface SearchSuccess {
  success: true;
  report: string;
  metadata: SearchMetadata;
}

/**
 * Failed search result
 */
export interface SearchError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Search result type
 */
export type SearchResult = SearchSuccess | SearchError;

/**
 * Build the search prompt from template
 */
async function buildSearchPrompt(query: string): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'prompts', 'search-prompt.md');

  try {
    const template = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    const modelDisplay = config.geminiModel || 'auto-select';
    const prompt = template
      .replace(/\{\{query\}\}/g, query)
      .replace(/\{\{topic\}\}/g, query) // For backward compatibility with template
      .replace(/\{\{model\}\}/g, modelDisplay);

    return prompt;
  } catch (error) {
    // Fallback to built-in prompt if template not found
    debugLog('Search prompt template not found, using fallback');
    return `You are a search agent. Perform a single-round search for: "${query}" using available tools. Return your response as JSON with fields: success (boolean), report (markdown string), and metadata (object with sources_visited array, search_queries_used array, and iterations number set to 1).`;
  }
}

/**
 * Main search function
 *
 * Performs a single-round search:
 * 1. Validates Gemini CLI availability
 * 2. Builds the search prompt from template
 * 3. Executes search with retry logic
 * 4. Returns structured result with metadata
 *
 * @param params - Search parameters including query
 * @returns Promise resolving to either a successful search result or an error
 */
export async function search(params: SearchParams): Promise<SearchResult> {
  const startTime = Date.now();
  const { query } = params;

  progressLog(`Starting search for: "${query}"`);

  // Check if gemini CLI is available
  const geminiAvailable = await checkGeminiCli();
  if (!geminiAvailable) {
    errorLog('Gemini CLI not found');
    return {
      success: false,
      error: {
        code: 'CLI_NOT_FOUND',
        message: 'Gemini CLI is not installed or not in PATH',
        details: 'Install Gemini CLI via: npm install -g @google/gemini-cli',
      },
    };
  }

  // Build the search prompt
  const prompt = await buildSearchPrompt(query);
  debugLog('Search prompt built successfully');

  // Execute search with retry logic and JSON correction fallback
  try {
    const { data: result, detectedModel } = await executeResearchWithCorrection(
      prompt,
      SEARCH_SCHEMA,
      config.geminiModel
    );

    const duration = Date.now() - startTime;
    progressLog(`Search completed in ${duration}ms`);

    // Check if the result indicates success
    if (result.success && typeof result.report === 'string') {
      // Use configured model, or detected model, or placeholder
      const model = config.geminiModel || detectedModel || 'auto-detected';

      return {
        success: true,
        report: result.report,
        metadata: {
          duration_ms: duration,
          query,
          model,
          timestamp: new Date().toISOString(),
          sources_visited: Array.isArray((result.metadata as Record<string, unknown>)?.sources_visited)
            ? (result.metadata as Record<string, unknown>).sources_visited as string[]
            : undefined,
          search_queries_used: Array.isArray((result.metadata as Record<string, unknown>)?.search_queries_used)
            ? (result.metadata as Record<string, unknown>).search_queries_used as string[]
            : undefined,
          iterations: typeof (result.metadata as Record<string, unknown>)?.iterations === 'number'
            ? (result.metadata as Record<string, unknown>).iterations as number
            : 1,
        },
      };
    }

    // Result indicates failure
    return {
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: 'Search task completed but returned failure status',
        details: result.report as string || 'No details provided',
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as Error;

    errorLog(`Search failed after ${duration}ms: ${err.message}`);

    return {
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: err.message,
        details: err.stack,
      },
    };
  }
}
