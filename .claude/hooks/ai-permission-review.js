#!/usr/bin/env node
/**
 * AI Permission Review Hook for Claude Code
 * Save as: .claude/hooks/ai-permission-review.js
 * Make executable: chmod +x .claude/hooks/ai-permission-review.js
 */

import { spawn } from 'child_process';
import { readFileSync, appendFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output (for debugging to stderr)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

/**
 * Debug logging to stderr and log file (doesn't interfere with JSON output)
 * Uses synchronous operations to ensure logs are written before exit
 */
function debug(message, projectDir = process.cwd()) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Write to stderr with colors
  process.stderr.write(`${colors.gray}${logMessage}${colors.reset}\n`);
  // Force flush stderr to ensure output is visible
  if (typeof process.stderr.flush === 'function') {
    try {
      process.stderr.flush();
    } catch {
      // Ignore flush errors
    }
  }

  // Also write to log file synchronously
  const logPath = join(projectDir, '.claude', 'hook-debug.log');
  try {
    appendFileSync(logPath, `${timestamp} | ${message}\n`);
  } catch (err) {
    process.stderr.write(`[${timestamp}] Failed to write to log file: ${err}\n`);
    if (typeof process.stderr.flush === 'function') {
      try {
        process.stderr.flush();
      } catch {
        // Ignore flush errors
      }
    }
  }
}

/**
 * Extract target information based on tool type
 */
function extractTarget(toolName, toolInput) {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return toolInput?.file_path || toolInput?.path || 'unknown';
    case 'Bash':
      return toolInput?.command || 'unknown';
    case 'Glob':
      return toolInput?.pattern || 'unknown';
    case 'Grep':
      return toolInput?.pattern || 'unknown';
    default:
      return 'various';
  }
}

/**
 * Check if Read permission is pre-approved in settings file
 */
function isReadPreApproved(settingsPath) {
  if (!existsSync(settingsPath)) {
    return false;
  }

  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const allowList = settings?.permissions?.allow;
    if (!Array.isArray(allowList)) {
      return false;
    }
    return allowList.some(perm => perm === 'Read' || perm === '*');
  } catch (err) {
    debug(`Error reading settings file ${settingsPath}: ${err.message}`);
    return false;
  }
}

/**
 * Check settings hierarchy for Read pre-approval
 */
function checkReadPreApproved() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Priority order: local → project → user
  const settingsPaths = [
    join(projectDir, '.claude', 'settings.local.json'),
    join(projectDir, '.claude', 'settings.json'),
    join(homedir(), '.claude', 'settings.json'),
  ];

  for (const path of settingsPaths) {
    if (isReadPreApproved(path)) {
      return true;
    }
  }
  return false;
}

/**
 * Spawn Claude Code and get its response
 */
function askClaudeForReview(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt];
    const claude = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000, // 120 seconds
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0 || stdout.length > 0) {
        resolve(stdout);
      } else {
        // On timeout or error, return a marker
        resolve('TIMEOUT_OR_ERROR');
      }
    });

    claude.on('error', (err) => {
      debug(`Claude process error: ${err.message}`);
      resolve('TIMEOUT_OR_ERROR');
    });
  });
}

/**
 * Extract JSON decision from Claude's response
 * Handles various formats: plain JSON, markdown code blocks, mixed content
 */
function extractDecision(output) {
  if (!output || output === 'TIMEOUT_OR_ERROR') {
    return null;
  }

  // Try to find a JSON object with "decision" field
  const patterns = [
    // Fenced code block with json
    /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    // Any JSON object with decision field
    /\{[^}]*"decision"[^}]*\}/,
    // Any JSON object (last resort)
    /\{[\s\S]*?\}/,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      try {
        const jsonStr = match[1] || match[0];
        const parsed = JSON.parse(jsonStr);
        if (parsed.decision) {
          return parsed;
        }
      } catch {
        // Try next pattern
      }
    }
  }

  // Try parsing entire output as JSON
  try {
    const parsed = JSON.parse(output.trim());
    if (parsed.decision) {
      return parsed;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Construct the review prompt
 */
function buildReviewPrompt(toolName, description, toolInput) {
  return `You are a security reviewer for Claude Code operations. Your task is to review whether this tool call should be approved.

## Your Instructions

1. First, review the project's approval guidelines by running: /approve-action
2. Read the project context (CLAUDE.md, README.md, etc.) to understand the project
3. Evaluate the specific tool call against the guidelines
4. Make a decision: allow, deny, or ask

## Tool Call to Review

Tool Name: ${toolName}

Description: ${description || 'No description provided'}

Tool Parameters:
${JSON.stringify(toolInput, null, 2)}

## Required Output Format

You MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation):

{
  "decision": "allow" | "deny" | "ask",
  "reason": "Brief explanation for your decision",
  "riskLevel": "low" | "medium" | "high"
}

Decision meanings:
- "allow": Safe operation that aligns with approval guidelines
- "deny": Dangerous operation or violates approval guidelines
- "ask": Uncertain, requires human review

Base your decision on:
1. The approval guidelines from /approve-action
2. Security and safety considerations
3. Risk vs benefit analysis

Respond with ONLY the JSON object, nothing else.`;
}

/**
 * Log decision to audit log
 */
async function logDecision(sessionId, toolName, decision, riskLevel, target, reason, projectDir) {
  const logPath = join(projectDir, '.claude', 'permission-audit.log');
  const fs = await import('fs/promises');

  try {
    await fs.mkdir(dirname(logPath), { recursive: true });
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} | ${sessionId} | ${toolName} | ${decision} | ${riskLevel} | ${target} | ${reason}\n`;
    await fs.appendFile(logPath, logLine);
  } catch (err) {
    debug(`Error writing audit log: ${err.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Get project directory early for logging
    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

    // Read hook input from stdin
    let hookInput = '';
    for await (const chunk of process.stdin) {
      hookInput += chunk;
    }

    debug(`Hook triggered with input: ${hookInput}`, projectDir);

    // Parse hook input
    let hookData;
    try {
      hookData = JSON.parse(hookInput);
    } catch (err) {
      debug(`Failed to parse hook input: ${err.message}`, projectDir);
      debug(`Input was: ${hookInput}`, projectDir);
      process.exit(1);
      return;
    }

    // Extract key information
    const toolName = hookData.tool_name || hookData.toolName;
    const toolInput = hookData.tool_input || hookData.toolInput || {};
    const sessionId = hookData.session_id || hookData.sessionId || 'unknown';
    const description = hookData.description || toolInput.description || '';

    // Also check environment variables as fallback
    const finalToolName = process.env.CLAUDE_TOOL_NAME || toolName;
    const finalToolInput = process.env.CLAUDE_TOOL_INPUT ? JSON.parse(process.env.CLAUDE_TOOL_INPUT) : toolInput;

    // Validate required fields
    if (!finalToolName) {
      debug('Missing tool_name in hook input', projectDir);
      debug(`Hook input was: ${hookInput}`, projectDir);
      process.exit(1);
      return;
    }

    const target = extractTarget(finalToolName, finalToolInput);

    // Check if Read is pre-approved (required to avoid hook recursion)
    if (!checkReadPreApproved()) {
      debug('AI reviewer unavailable (READ not pre-approved in permissions.allow) - manual review required', projectDir);
      // Exit without output - let user approve manually
      process.exit(0);
      return;
    }

    // Build and send review prompt
    const prompt = buildReviewPrompt(finalToolName, description, finalToolInput);
    debug('About to call claude reviewer', projectDir);

    const aiOutput = await askClaudeForReview(prompt);
    debug(`Claude reviewer returned: ${aiOutput}`, projectDir);

    // Extract decision from output
    const aiDecision = extractDecision(aiOutput);

    let decision = 'ask';
    let reason = 'AI review failed - requires human review';
    let riskLevel = 'medium';

    if (aiDecision) {
      decision = aiDecision.decision || 'ask';
      reason = aiDecision.reason || 'AI review completed';
      riskLevel = aiDecision.riskLevel || 'medium';
    }

    // Log decision for audit trail
    await logDecision(sessionId, finalToolName, decision, riskLevel, target, reason, projectDir);

    // Return decision based on result
    switch (decision) {
      case 'allow':
        console.log(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PermissionRequest',
            decision: { behavior: 'allow' },
          },
        }));
        process.exit(0);
        break;

      case 'deny':
        debug("AI reviewer returned 'deny' - manual review required", projectDir);
        // Exit without output - let user handle
        process.exit(0);
        break;

      case 'ask':
        debug("AI reviewer returned 'ask' - manual review required", projectDir);
        // Exit without output - let user handle
        process.exit(0);
        break;

      default:
        debug(`Invalid AI decision: ${decision}`);
        process.exit(1);
        break;
    }
  } catch (err) {
    debug(`Unexpected error: ${err.message}`);
    debug(err.stack);
    process.exit(1);
  }
}

// Run main
main();
