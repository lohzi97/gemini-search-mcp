/**
 * Shared utility functions for Gemini CLI interaction
 */

import { spawn, type ChildProcess } from 'child_process';
import { config, debugLog, progressLog, warnLog, errorLog } from './config.js';

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
export async function spawnGeminiCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    debugLog(`Spawning gemini process with model: ${config.geminiModel}`);
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

    let timedOut = false;

    try {
      // Spawn gemini process with stdin piping
      process = spawn('gemini', ['--model', config.geminiModel], {
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
 * Execute research with retry logic
 */
export async function executeResearchWithRetry(
  prompt: string,
  maxRetries: number = config.jsonMaxRetries
): Promise<Record<string, unknown>> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    debugLog(`Research attempt ${attempt}/${maxRetries}`);

    try {
      const result = await spawnGeminiCli(prompt);

      // Try to extract JSON from output
      const parsed = extractJsonFromOutput(result);

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
