/**
 * Deep search tool implementation
 * Multi-round iterative search with verification loop
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  checkGeminiCli,
  extractJsonFromOutput,
  spawnGeminiCli,
  validateResearchResult,
} from './utils.js';
import { config, debugLog, progressLog, errorLog } from './config.js';

// Get the directory name of the current module for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deep search parameters
 */
export interface DeepSearchParams {
  topic: string;
  maxIterations?: number;
}

/**
 * Round metadata for tracking each iteration
 */
export interface RoundMetadata {
  round: number;
  sources_visited?: string[];
  search_queries_used?: string[];
}

/**
 * Deep search result metadata
 */
export interface DeepSearchMetadata {
  duration_ms: number;
  topic: string;
  model: string;
  timestamp: string;
  total_iterations: number;
  verified: boolean;
  all_sources: string[];
  rounds: RoundMetadata[];
}

/**
 * Successful deep search result
 */
export interface DeepSearchSuccess {
  success: true;
  report: string;
  verified: boolean;
  metadata: DeepSearchMetadata;
}

/**
 * Failed deep search result
 */
export interface DeepSearchError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Deep search result type
 */
export type DeepSearchResult = DeepSearchSuccess | DeepSearchError;

/**
 * Intermediate result from a single round
 */
interface IntermediateResult {
  success: boolean;
  verified?: boolean;
  report: string;
  metadata: {
    sources_visited?: string[];
    search_queries_used?: string[];
    iterations?: number;
  };
}

/**
 * Build the deep search initial prompt from template
 */
async function buildDeepSearchPrompt(topic: string): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'prompts', 'deep-search-prompt.md');

  try {
    const template = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    const prompt = template
      .replace(/\{\{topic\}\}/g, topic)
      .replace(/\{\{model\}\}/g, config.geminiModel);

    return prompt;
  } catch (error) {
    // Fallback to built-in prompt if template not found
    debugLog('Deep search prompt template not found, using fallback');
    return `You are a deep search agent. Perform comprehensive research on: "${topic}" using available tools. Use multiple search perspectives and gather comprehensive information. Return your response as JSON with fields: success (boolean), verified (boolean, set to false), report (markdown string), and metadata (object with sources_visited array, search_queries_used array, and iterations number).`;
  }
}

/**
 * Build the verification prompt from template
 */
async function buildVerifyPrompt(
  topic: string,
  previousResult: string,
  currentRound: number,
  maxIterations: number
): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'prompts', 'verify-prompt.md');

  try {
    const template = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    const maxRemaining = maxIterations - currentRound;
    const prompt = template
      .replace(/\{\{topic\}\}/g, topic)
      .replace(/\{\{previous_result\}\}/g, previousResult)
      .replace(/\{\{current_round\}\}/g, currentRound.toString())
      .replace(/\{\{max_iterations\}\}/g, maxIterations.toString())
      .replace(/\{\{max_remaining\}\}/g, maxRemaining.toString())
      .replace(/\{\{model\}\}/g, config.geminiModel);

    return prompt;
  } catch (error) {
    // Fallback to built-in prompt if template not found
    debugLog('Verification prompt template not found, using fallback');
    return `You are a verification agent. Review and improve the following research on: "${topic}"\n\nPrevious result:\n${previousResult}\n\nSearch for additional sources to verify or enhance the findings. Round ${currentRound}/${maxIterations}. Return your response as JSON with fields: success (boolean), verified (boolean - set true if comprehensive and accurate), report (markdown string), and metadata (object with sources_visited array, search_queries_used array, and iterations number).`;
  }
}

/**
 * Execute a single search round with retry logic
 */
async function executeSearchRound(
  prompt: string,
  maxRetries: number = config.jsonMaxRetries
): Promise<IntermediateResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog(`Search round attempt ${attempt}/${maxRetries}`);

    try {
      const result = await spawnGeminiCli(prompt);

      // Try to extract JSON from output
      const parsed = extractJsonFromOutput(result);

      if (parsed && validateResearchResult(parsed)) {
        debugLog('Valid JSON result obtained for round');
        return parsed as IntermediateResult;
      }

      // Validation failed, retry
      debugLog('JSON validation failed for round, retrying...');
      lastError = new Error('JSON validation failed');
    } catch (error) {
      debugLog(`Search round attempt ${attempt} failed:`, error);
      lastError = error as Error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  throw lastError || new Error('All search round attempts failed');
}

/**
 * Main deep_search function
 *
 * Performs multi-round iterative search with verification:
 * 1. Validates Gemini CLI availability
 * 2. Performs initial deep research with 5-perspective analysis
 * 3. Iteratively verifies and enhances results
 * 4. Completes when verified or max iterations reached
 * 5. Returns structured result with metadata
 *
 * @param params - Deep search parameters including topic and optional max iterations
 * @returns Promise resolving to either a successful deep search result or an error
 */
export async function deepSearch(params: DeepSearchParams): Promise<DeepSearchResult> {
  const startTime = Date.now();
  const { topic, maxIterations = config.deepSearchMaxIterations } = params;

  progressLog(`Starting deep search on: "${topic}" (max iterations: ${maxIterations})`);

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

  // Track all sources and round metadata
  const allSources: string[] = [];
  const rounds: RoundMetadata[] = [];
  let currentReport = '';
  let verified = false;

  try {
    // Round 1: Initial deep research
    progressLog('Deep search round 1/' + maxIterations + ' (initial research)...');
    const initialPrompt = await buildDeepSearchPrompt(topic);
    debugLog('Initial deep search prompt built successfully');

    const initialResult = await executeSearchRound(initialPrompt);

    if (!initialResult.success) {
      return {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Initial deep search failed',
          details: initialResult.report,
        },
      };
    }

    currentReport = initialResult.report;
    verified = initialResult.verified ?? false;

    // Collect metadata from round 1
    if (initialResult.metadata?.sources_visited) {
      allSources.push(...initialResult.metadata.sources_visited);
    }
    rounds.push({
      round: 1,
      sources_visited: initialResult.metadata?.sources_visited,
      search_queries_used: initialResult.metadata?.search_queries_used,
    });

    debugLog(`Round 1 complete. Verified: ${verified}`);

    // Verification rounds (2 to maxIterations)
    for (let round = 2; round <= maxIterations && !verified; round++) {
      progressLog(`Deep search round ${round}/${maxIterations} (verification)...`);

      const verifyPrompt = await buildVerifyPrompt(
        topic,
        currentReport,
        round,
        maxIterations
      );

      const verifyResult = await executeSearchRound(verifyPrompt);

      if (!verifyResult.success) {
        debugLog(`Verification round ${round} failed, continuing with previous result`);
        break;
      }

      currentReport = verifyResult.report;
      verified = verifyResult.verified ?? false;

      // Collect metadata from verification round
      if (verifyResult.metadata?.sources_visited) {
        allSources.push(...verifyResult.metadata.sources_visited);
      }
      rounds.push({
        round,
        sources_visited: verifyResult.metadata?.sources_visited,
        search_queries_used: verifyResult.metadata?.search_queries_used,
      });

      debugLog(`Round ${round} complete. Verified: ${verified}`);
    }

    const duration = Date.now() - startTime;
    const statusMsg = verified ? 'verified' : 'completed max iterations';
    progressLog(`Deep search ${statusMsg} in ${duration}ms`);

    return {
      success: true,
      report: currentReport,
      verified,
      metadata: {
        duration_ms: duration,
        topic,
        model: config.geminiModel,
        timestamp: new Date().toISOString(),
        total_iterations: rounds.length,
        verified,
        all_sources: [...new Set(allSources)], // Deduplicate sources
        rounds,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as Error;

    errorLog(`Deep search failed after ${duration}ms: ${err.message}`);

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
