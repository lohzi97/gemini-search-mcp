/**
 * Deep research tool implementation
 * Spawns Gemini CLI and handles output parsing
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config, debugLog, progressLog, warnLog, errorLog } from './config.js';

// Get the directory name of the current module for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Research parameters
 */
export interface ResearchParams {
  topic: string;
  depth: 'concise' | 'detailed';
}

/**
 * Research result metadata
 */
export interface ResearchMetadata {
  duration_ms: number;
  topic: string;
  depth: string;
  model: string;
  timestamp: string;
  sources_visited?: string[];
  search_queries_used?: string[];
  iterations?: number;
}

/**
 * Successful research result
 */
export interface ResearchSuccess {
  success: true;
  report: string;
  metadata: ResearchMetadata;
}

/**
 * Failed research result
 */
export interface ResearchError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Research result type
 */
export type ResearchResult = ResearchSuccess | ResearchError;

/**
 * Check if gemini CLI is available
 */
async function checkGeminiCli(): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      const process = spawn('gemini', ['--version'], { stdio: 'pipe' });
      process.on('error', () => resolve(false));
      process.on('close', (code) => resolve(code === 0));
    });
  } catch {
    return false;
  }
}

/**
 * Extract JSON from CLI output
 */
function extractJsonFromOutput(output: string): Record<string, unknown> | null {
  debugLog('Attempting to extract JSON from CLI output');

  // Strategy 1: Look for ```json ... ``` code blocks
  const fenceMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      debugLog('JSON extracted from fence pattern');
      return parsed;
    } catch {
      debugLog('Failed to parse JSON from fence pattern');
    }
  }

  // Strategy 2: Look for first {...} pattern (raw JSON object)
  const objectMatch = output.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      debugLog('JSON extracted from raw object pattern');
      return parsed;
    } catch {
      debugLog('Failed to parse JSON from raw object pattern');
    }
  }

  debugLog('Failed to extract JSON from output');
  return null;
}

/**
 * Validate parsed JSON has required fields
 */
function validateResearchResult(data: Record<string, unknown>): data is Record<string, unknown> & {
  success: boolean;
  report?: string;
} {
  if (typeof data.success !== 'boolean') {
    return false;
  }
  if (data.success && typeof data.report !== 'string') {
    return false;
  }
  return true;
}

/**
 * Build the research prompt from template
 */
async function buildPrompt(topic: string, depth: string): Promise<string> {
  // Read the prompt template
  // Resolve path relative to the built file location (supports global npm installs)
  // When installed globally, __dirname will be in the node_modules package directory
  const templatePath = path.join(__dirname, '..', 'prompts', 'research-prompt.md');

  try {
    const template = await fs.readFile(templatePath, 'utf-8');

    // Replace placeholders
    let prompt = template
      .replace(/\{\{topic\}\}/g, topic)
      .replace(/\{\{depth\}\}/g, depth)
      .replace(/\{\{model\}\}/g, config.geminiModel);

    // If custom system prompt is provided, use it instead
    if (config.geminiSystemPrompt) {
      prompt = config.geminiSystemPrompt
        .replace(/\{topic\}/g, topic)
        .replace(/\{depth\}/g, depth)
        .replace(/\{model\}/g, config.geminiModel);
    }

    return prompt;
  } catch (error) {
    // Fallback to built-in prompt if template not found
    debugLog('Prompt template not found, using fallback');
    return `You are a research agent. Research the topic: "${topic}" with depth: "${depth}" using available tools. Return your response as JSON with fields: success (boolean), report (markdown string), and metadata (object with sources_visited array and iterations number).`;
  }
}

/**
 * Execute research with retry logic
 */
async function executeResearchWithRetry(
  prompt: string,
  maxRetries: number = config.jsonMaxRetries
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog(`Research attempt ${attempt}/${maxRetries}`);

    try {
      const result = await spawnGeminiCli(prompt);

      // Try to extract JSON from output
      const parsed = extractJsonFromResult(result);

      if (parsed && validateResearchResult(parsed)) {
        debugLog('Valid JSON result obtained');
        return parsed;
      }

      // Validation failed, retry
      debugLog('JSON validation failed, retrying...');
      lastError = new Error('JSON validation failed');
    } catch (error) {
      debugLog(`Research attempt ${attempt} failed:`, error);
      lastError = error as Error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  throw lastError || new Error('All research attempts failed');
}

/**
 * Get helpful error message for Gemini CLI exit code
 */
function getExitCodeMessage(code: number | null): string {
  if (code === null) return 'Process terminated by signal';

  const messages: Record<number, string> = {
    1: 'General error - Check Gemini CLI configuration and authentication',
    2: 'Misuse of shell command - Verify CLI arguments',
    126: 'Command invoked cannot execute - Check Gemini CLI installation',
    127: 'Command not found - Install Gemini CLI via: npm install -g @google/gemini-cli',
    130: 'Process terminated by SIGINT (Ctrl+C)',
    143: 'Process terminated by SIGTERM',
    255: 'Exit status out of range - Possible environment issue',
  };

  return messages[code] || `Unknown error code ${code}`;
}

/**
 * Spawn Gemini CLI and capture output
 */
async function spawnGeminiCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    debugLog(`Spawning gemini process with model: ${config.geminiModel}`);
    debugLog(`Working directory: ${config.configDir}`);

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let process: ChildProcess | null = null;

    // Progress log interval
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 15000) {
        const seconds = Math.floor(elapsed / 1000);
        if (elapsed > 120000) {
          warnLog(`Research taking longer than expected... (elapsed: ${seconds}s)`);
        } else {
          progressLog(`Research in progress... (elapsed: ${seconds}s)`);
        }
      }
    }, config.progressLogInterval);

    // Cleanup function
    const cleanup = () => {
      clearInterval(progressInterval);
      if (process && !process.killed) {
        debugLog('Terminating gemini process');
        process.kill('SIGTERM');
        // Force kill after 5 seconds
        setTimeout(() => {
          if (process && !process.killed) {
            debugLog('Force killing gemini process');
            process.kill('SIGKILL');
          }
        }, 5000);
      }
    };

    try {
      // Spawn gemini process with stdin piping
      process = spawn('gemini', ['--model', config.geminiModel], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: config.configDir,
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        errorLog('Research timeout reached');
        cleanup();
        reject(new Error(`Research task exceeded timeout of ${config.geminiTimeout}ms`));
      }, config.geminiTimeout);

      // Handle stdout
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Handle stderr
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
        if (config.debug) {
          console.error('[GEMINI STDERR]', data.toString());
        }
      });

      // Handle process close
      process.on('close', (code) => {
        clearTimeout(timeout);
        clearInterval(progressInterval);

        debugLog(`Gemini process exited with code: ${code}`);

        if (code !== 0) {
          const exitMessage = getExitCodeMessage(code);
          const errorMessage = `Gemini CLI exited with code ${code}. ${exitMessage}`;
          reject(new Error(errorMessage + (stderr ? ` Details: ${stderr}` : '')));
        } else {
          resolve(stdout);
        }
      });

      // Handle process error
      process.on('error', (err) => {
        clearTimeout(timeout);
        clearInterval(progressInterval);
        cleanup();
        reject(new Error(`Failed to spawn gemini process: ${err.message}`));
      });

      // Write prompt to stdin and close
      debugLog('Writing prompt to stdin');
      process.stdin?.write(prompt);
      process.stdin?.end();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

/**
 * Extract and validate JSON from CLI result
 */
function extractJsonFromResult(output: string): Record<string, unknown> | null {
  const parsed = extractJsonFromOutput(output);
  if (parsed && validateResearchResult(parsed)) {
    return parsed;
  }
  return null;
}

/**
 * Main deep_research function
 *
 * Orchestrates the complete research process:
 * 1. Validates Gemini CLI availability
 * 2. Builds the research prompt from template
 * 3. Executes research with retry logic
 * 4. Returns structured result with metadata
 *
 * @param params - Research parameters including topic and depth
 * @returns Promise resolving to either a successful research result or an error
 */
export async function deepResearch(params: ResearchParams): Promise<ResearchResult> {
  const startTime = Date.now();
  const { topic, depth } = params;

  progressLog(`Starting research on: "${topic}" (depth: ${depth})`);

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

  // Build the research prompt
  const prompt = await buildPrompt(topic, depth);
  debugLog('Prompt built successfully');

  // Execute research with retry logic
  try {
    const result = await executeResearchWithRetry(prompt);

    const duration = Date.now() - startTime;
    progressLog(`Research completed in ${duration}ms`);

    // Check if the result indicates success
    if (result.success && typeof result.report === 'string') {
      return {
        success: true,
        report: result.report,
        metadata: {
          duration_ms: duration,
          topic,
          depth,
          model: config.geminiModel,
          timestamp: new Date().toISOString(),
          sources_visited: Array.isArray((result.metadata as Record<string, unknown>)?.sources_visited)
            ? (result.metadata as Record<string, unknown>).sources_visited as string[]
            : undefined,
          search_queries_used: Array.isArray((result.metadata as Record<string, unknown>)?.search_queries_used)
            ? (result.metadata as Record<string, unknown>).search_queries_used as string[]
            : undefined,
          iterations: typeof (result.metadata as Record<string, unknown>)?.iterations === 'number'
            ? (result.metadata as Record<string, unknown>).iterations as number
            : undefined,
        },
      };
    }

    // Result indicates failure
    return {
      success: false,
      error: {
        code: 'RESEARCH_FAILED',
        message: 'Research task completed but returned failure status',
        details: result.report as string || 'No details provided',
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const err = error as Error;

    errorLog(`Research failed after ${duration}ms: ${err.message}`);

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
