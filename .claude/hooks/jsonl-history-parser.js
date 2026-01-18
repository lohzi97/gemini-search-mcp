#!/usr/bin/env node
/**
 * JSONL History Parser for AI Permission Review
 * Converts Claude Code transcript JSONL to compacted markdown format
 * Using "Narrative Compact" strategy: summarize historical tool use, preserve current round fully
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Truncate text if it exceeds max length (for copy-pastes)
 */
function truncateText(text, maxLines = 100) {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + `\n\n[... ${lines.length - maxLines} more lines truncated ...]`;
}

/**
 * Summarize a tool use call for historical rounds
 */
function summarizeToolUse(toolUse) {
  const toolName = toolUse.name || 'Unknown';
  let target = 'unknown';

  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit':
      target = toolUse.input?.file_path || toolUse.input?.path || 'unknown';
      break;
    case 'Bash':
      target = toolUse.input?.command?.split(' ')[0] || 'unknown';
      break;
    case 'Glob':
      target = toolUse.input?.pattern || 'unknown';
      break;
    case 'Grep':
      target = toolUse.input?.pattern || 'unknown';
      break;
    case 'AskUserQuestion':
      target = 'user';
      break;
    default:
      target = 'various';
  }

  return `[Action: ${toolName} on "${target}"]`;
}

/**
 * Summarize tool result for historical rounds
 */
function summarizeToolResult(resultContent) {
  const isError = resultContent.isError;
  const status = isError ? 'Error' : 'Success';

  if (resultContent.content) {
    const content = resultContent.content;
    if (typeof content === 'string') {
      const lines = content.split('\n').length;
      return `[Result: ${status} - ${lines} lines]`;
    }
    return `[Result: ${status}]`;
  }

  return `[Result: ${status}]`;
}

/**
 * Parse JSONL and convert to compacted markdown
 */
function parseTranscriptToJsonl(transcriptPath, outputPath) {
  if (!existsSync(transcriptPath)) {
    throw new Error(`Transcript not found: ${transcriptPath}`);
  }

  // Read and parse JSONL
  const jsonlContent = readFileSync(transcriptPath, 'utf8');
  const lines = jsonlContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return '# Conversation History\n\n[Empty transcript]';
  }

  const entries = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      return null;
    }
  }).filter(e => e !== null);

  if (entries.length === 0) {
    return '# Conversation History\n\n[No valid messages in transcript]';
  }

  // Filter to only user and assistant entries
  const messages = entries.filter(e => e.type === 'user' || e.type === 'assistant');

  // Build markdown
  let markdown = '# Conversation History\n\n';
  let turnNumber = 1;
  let i = 0;

  // Process messages into turns
  while (i < messages.length) {
    const msg = messages[i];
    const msgType = msg.type;
    const role = msg.message?.role;

    // Start a new turn on user message
    if (msgType === 'user' && role === 'user') {
      // Extract user text from message.content
      // User content can be either a string or an array of content blocks
      const msgContent = msg.message?.content;
      let userText = '[No text]';
      let hasRealContent = false;

      if (typeof msgContent === 'string') {
        // Old format - content is directly a string
        userText = msgContent;
        hasRealContent = userText.length > 0 && userText !== '[No text]';
      } else if (Array.isArray(msgContent)) {
        // New format - content is an array of content blocks
        for (const content of msgContent) {
          if (content.type === 'text') {
            userText = content.text || '[Empty text]';
            hasRealContent = true;
            break;
          } else if (content.type === 'tool_result') {
            // Tool result from user - this is a response to assistant's tool use
            // These are part of the assistant's turn, not a new turn
            hasRealContent = false;
            break;
          }
        }
      }

      // Skip if this is just a tool result message (no real user content)
      if (!hasRealContent) {
        i++;
        continue;
      }

      // Check if this is the last message or close to end
      const isLastTurn = (i === messages.length - 1);
      const isHistorical = !isLastTurn;

      markdown += `## Turn ${turnNumber}${isHistorical ? '' : ' (Current / Active)'}\n`;
      markdown += `**User:** ${isHistorical ? truncateText(userText) : userText}\n\n`;

      // Look for assistant response and any related tool results
      let j = i + 1;
      while (j < messages.length) {
        const nextMsg = messages[j];
        const nextType = nextMsg.type;
        const nextRole = nextMsg.message?.role;

        if (nextType === 'assistant' && nextRole === 'assistant') {
          const assistantContent = nextMsg.message?.content || [];

          for (const content of assistantContent) {
            if (content.type === 'text') {
              const text = content.text || '';
              markdown += `**Assistant:** ${isHistorical ? truncateText(text, 200) : text}\n\n`;
            } else if (content.type === 'tool_use') {
              if (isHistorical) {
                markdown += `**${summarizeToolUse(content)}**\n\n`;
              } else {
                // Full detail for current round
                const toolName = content.name || 'Unknown';
                const input = JSON.stringify(content.input || {}, null, 2);
                markdown += `**Tool: ${toolName}**\n\`\`\`json\n${input}\n\`\`\`\n\n`;
              }
            }
            // Skip 'thinking' type - internal reasoning
          }
          j++;
        } else if (nextType === 'user' && nextRole === 'user') {
          // Check if this is a tool result message
          const resultContent = nextMsg.message?.content;
          let hasToolResult = false;

          if (Array.isArray(resultContent)) {
            for (const rc of resultContent) {
              if (rc.type === 'tool_result') {
                if (isHistorical) {
                  markdown += `**${summarizeToolResult(rc)}**\n\n`;
                } else {
                  const status = rc.isError ? 'Error' : 'Success';
                  const resultText = rc.content || '';
                  markdown += `**Result: ${status}**\n\`\`\`\n${resultText}\n\`\`\`\n\n`;
                }
                hasToolResult = true;
              }
            }
          }

          if (hasToolResult) {
            // This is a tool result, continue processing
            j++;
          } else {
            // This is a new user message with actual content, stop here
            break;
          }
        } else {
          // Unknown message type, stop here
          break;
        }
      }

      i = j - 1; // Will increment to skip processed messages

      turnNumber++;
    }

    i++;
  }

  // Write to output file
  writeFileSync(outputPath, markdown, 'utf8');

  return markdown;
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: jsonl-history-parser.js <transcript_path> <output_path>');
    process.exit(1);
  }

  const [transcriptPath, outputPath] = args;

  try {
    parseTranscriptToJsonl(transcriptPath, outputPath);
    console.log(JSON.stringify({
      success: true,
      outputPath,
    }));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: err.message,
    }));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseTranscriptToJsonl };
