/**
 * Shared utility functions for Gemini CLI interaction
 */

import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config, debugLog, progressLog, warnLog, errorLog } from './config.js';

/**
 * JSON schema constants for correction prompts
 */

export const SEARCH_SCHEMA = `{
  "success": true,
  "report": "# Your Report Title\\n\\n## Key Findings\\n- First finding\\n- Second finding\\n\\n## Details\\nMore detailed information...\\n\\n## Sources\\n1. Source title with URL",
  "metadata": {
    "sources_visited": ["https://example1.com", "https://example2.com"],
    "search_queries_used": ["primary search query"],
    "iterations": 1
  }
}`;

export const DEEP_SEARCH_SCHEMA = `{
  "success": true,
  "verified": false,
  "report": "# Comprehensive Report Title\\n\\n## Executive Summary\\nBrief overview of findings...\\n\\n## Key Findings\\n### Perspective 1: Technical\\n- Technical details...\\n\\n### Perspective 2: Historical Context\\n- Historical information...\\n\\n### Perspective 3: Current Trends\\n- Current developments...\\n\\n### Perspective 4: Expert Opinions\\n- Expert viewpoints...\\n\\n### Perspective 5: Statistics and Data\\n- Data-driven insights...\\n\\n## Detailed Analysis\\nMore comprehensive analysis...\\n\\n## Sources\\n1. Source title with URL",
  "metadata": {
    "sources_visited": ["https://example1.com", "https://example2.com"],
    "search_queries_used": ["query1", "query2", "query3"],
    "iterations": 1
  }
}`;

/**
 * Check if gemini CLI is available
 */
export async function checkGeminiCli(): Promise<boolean> {
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
export function extractJsonFromOutput(output: string): Record<string, unknown> | null {
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
 * Validate parsed JSON has required fields for a research result
 */
export function validateResearchResult(data: Record<string, unknown>): data is Record<string, unknown> & {
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
 * Clean up orphaned temporary files from previous crashes
 */
export async function cleanupOrphanedTempFiles(): Promise<void> {
  try {
    const files = await fs.readdir(config.configDir);
    const tempFiles = files.filter(f => f.startsWith('temp-invalid-output-') && f.endsWith('.txt'));

    if (tempFiles.length > 0) {
      debugLog(`Found ${tempFiles.length} orphaned temporary file(s)`);
      for (const file of tempFiles) {
        const filePath = path.join(config.configDir, file);
        try {
          await fs.unlink(filePath);
          debugLog(`Cleaned up orphaned temp file: ${file}`);
        } catch (error) {
          warnLog(`Failed to clean up temp file ${file}: ${(error as Error).message}`);
        }
      }
    } else {
      debugLog('No orphaned temporary files found');
    }
  } catch (error) {
    // Config directory might not exist yet, which is fine
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      debugLog('Config directory does not exist yet, skipping cleanup');
    } else {
      warnLog(`Error during temp file cleanup: ${(error as Error).message}`);
    }
  }
}

/**
 * Detect model name from CLI output
 */
export function detectModelFromCliOutput(output: string): string | null {
  // Try to find model name in stderr/debug output
  // Typical patterns: "Using model: gemini-2.5-flash", "Model: gemini-2.5-pro"
  const modelPatterns = [
    /(?:using model|model):\s*([a-z0-9.-]+)/i,
    /gemini(?:-cli)?\s+using\s+([a-z0-9.-]+)/i,
  ];

  for (const pattern of modelPatterns) {
    const match = output.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
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
export async function spawnGeminiCli(prompt: string, model?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const modelDisplay = model || 'auto-select';
    debugLog(`Spawning gemini process with model: ${modelDisplay}`);
    debugLog(`Working directory: ${config.configDir}`);

    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let process: ChildProcess | null = null;
    let outputReceivedTime: number | null = null;

    // Progress log interval
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 15000) {
        const seconds = Math.floor(elapsed / 1000);
        if (elapsed > 120000) {
          warnLog(`Gemini CLI taking longer than expected... (elapsed: ${seconds}s)`);
        } else {
          progressLog(`Gemini CLI running... (elapsed: ${seconds}s)`);
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

    let timedOut = false;

    try {
      // Build CLI arguments - only include --model if specified
      const args = model ? ['--model', model] : [];
      args.push('--allowed-tools');
      args.push('web_fetch');
      debugLog(`CLI args: ${args.length > 0 ? args.join(' ') : '(no model flag, using auto-select)'}`);

      // Spawn gemini process with stdin piping
      process = spawn('gemini', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: config.configDir,
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        errorLog('Research timeout reached');
        timedOut = true;
        cleanup();
        reject(new Error(`Research task exceeded timeout of ${config.geminiTimeout}ms`));
      }, config.geminiTimeout);

      // Handle stdout
      process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (outputReceivedTime === null) {
          outputReceivedTime = Date.now();
          const timeToFirstOutput = outputReceivedTime - startTime;
          debugLog(`First stdout data received after ${timeToFirstOutput}ms (${chunk.length} bytes)`);
        }
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

        debugLog(`Gemini process exited with code: ${code}${timedOut ? ' (after timeout)' : ''}`);

        // If timeout already occurred, don't resolve/reject again
        if (timedOut) {
          debugLog('Ignoring close event - timeout already occurred');
          return;
        }

        if (code !== 0) {
          const exitMessage = getExitCodeMessage(code);
          const errorMessage = `Gemini CLI exited with code ${code}. ${exitMessage}`;
          reject(new Error(errorMessage + (stderr ? ` Details: ${stderr}` : '')));
        } else {
          const resolveTime = Date.now();
          const totalDuration = resolveTime - startTime;
          debugLog(`Resolving with ${stdout.length} bytes of output (total: ${totalDuration}ms)`);
          if (outputReceivedTime) {
            const timeFromFirstOutput = resolveTime - outputReceivedTime;
            debugLog(`Time from first output to close: ${timeFromFirstOutput}ms`);
          }
          resolve(stdout);
        }
      });

      // Handle process error
      process.on('error', (err) => {
        clearTimeout(timeout);
        clearInterval(progressInterval);
        cleanup();
        // If timeout already occurred, don't reject again
        if (!timedOut) {
          reject(new Error(`Failed to spawn gemini process: ${err.message}`));
        }
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
 * JSON correction result with detected model
 */
interface CorrectionResult {
  data: Record<string, unknown>;
  detectedModel?: string;
}

/**
 * Correct invalid JSON output using a separate LLM call
 */
async function correctJsonOutput(
  invalidOutput: string,
  schema: string,
  model?: string
): Promise<CorrectionResult> {
  const timestamp = Date.now();
  const tempFileName = `temp-invalid-output-${timestamp}.txt`;
  const tempFilePath = path.join(config.configDir, tempFileName);

  debugLog(`Attempting JSON correction with temp file: ${tempFileName}`);

  try {
    // Write invalid output to temp file
    await fs.writeFile(tempFilePath, invalidOutput, 'utf-8');
    debugLog(`Wrote ${invalidOutput.length} bytes to temp file`);

    // Build correction prompt
    const correctionPrompt = `You are a JSON correction specialist. Your task is to fix the following malformed JSON output and convert it into valid JSON format.

The original output was supposed to follow this schema:
${schema}

The invalid output is in the file at: ${tempFilePath}

Please:
1. Read the invalid output from the file
2. Fix any JSON syntax errors (missing quotes, trailing commas, unescaped characters, etc.)
3. Ensure the structure matches the expected schema
4. Preserve all the meaningful content from the original output

Respond with valid JSON only, wrapped in \`\`\`json ... \`\`\` code blocks. Do not include any explanatory text outside the JSON.`;

    // Use correction model if set, otherwise undefined (auto-select)
    const correctionModel = model ?? config.geminiCorrectionModel;
    const result = await spawnGeminiCli(correctionPrompt, correctionModel);

    // Try to extract JSON from correction output
    const parsed = extractJsonFromOutput(result);

    if (parsed && validateResearchResult(parsed)) {
      debugLog('JSON correction successful');
      return { data: parsed };
    }

    debugLog('JSON correction failed - output still invalid');
    throw new Error('Correction output is still invalid JSON');
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
      debugLog(`Cleaned up temp file: ${tempFileName}`);
    } catch (error) {
      warnLog(`Failed to clean up temp file ${tempFileName}: ${(error as Error).message}`);
    }
  }
}

/**
 * Execute research with retry logic and JSON correction fallback
 *
 * This function consolidates the retry logic from both search.ts and deep-search.ts.
 * It implements a new retry flow:
 * 1. Run main search prompt
 * 2. If JSON invalid, attempt single correction prompt
 * 3. If correction fails, proceed to next retry cycle
 * 4. Maximum 3 retry cycles with exponential backoff
 *
 * @param prompt - The research prompt to execute
 * @param schema - The JSON schema example for correction
 * @param model - Optional model for main search (uses config.geminiModel if not provided)
 * @returns Promise resolving to parsed JSON result with detected model
 */
export async function executeResearchWithCorrection(
  prompt: string,
  schema: string,
  model?: string
): Promise<CorrectionResult> {
  const maxRetries = config.jsonMaxRetries;
  const mainModel = model ?? config.geminiModel;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog(`Research attempt ${attempt}/${maxRetries}`);

    try {
      const result = await spawnGeminiCli(prompt, mainModel);

      // Try to extract JSON from output
      const parsed = extractJsonFromOutput(result);

      if (parsed && validateResearchResult(parsed)) {
        debugLog('Main search produced valid JSON');

        // Try to detect model from output if not explicitly set
        let detectedModel: string | undefined;
        if (!mainModel) {
          detectedModel = detectModelFromCliOutput(result) ?? undefined;
        }

        return { data: parsed, detectedModel };
      }

      // Main search output was invalid - try correction
      debugLog('Main search failed - attempting JSON correction');

      // Detect model from main search output before attempting correction
      let detectedModel: string | undefined;
      if (!mainModel) {
        detectedModel = detectModelFromCliOutput(result) ?? undefined;
      }

      try {
        const correctionResult = await correctJsonOutput(result, schema, config.geminiCorrectionModel);

        // Preserve detected model from main search (correction uses potentially different model)
        return { data: correctionResult.data, detectedModel };
      } catch (correctionError) {
        debugLog('JSON correction failed:', correctionError);
        lastError = correctionError as Error;
        // Continue to next retry cycle
      }
    } catch (error) {
      debugLog(`Research attempt ${attempt} failed:`, error);
      lastError = error as Error;
    }

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      debugLog(`Waiting ${delay}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed - provide detailed error
  const errorMsg = lastError
    ? `All ${maxRetries} research attempts failed. Last error: ${lastError.message}`
    : `All ${maxRetries} research attempts failed`;
  throw new Error(errorMsg);
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use executeResearchWithCorrection instead
 */
export async function executeResearchWithRetry(
  prompt: string
): Promise<Record<string, unknown>> {
  const result = await executeResearchWithCorrection(prompt, SEARCH_SCHEMA, config.geminiModel);
  return result.data;
}
