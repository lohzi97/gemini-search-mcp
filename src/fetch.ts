/**
 * Webpage fetch tool implementation
 * Fetches HTML content from a URL, converts to Markdown, and cleans up with AI
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';
import {
  checkGeminiCli,
  spawnGeminiCli,
  detectModelFromCliOutput,
} from './utils.js';
import { config, debugLog, progressLog, warnLog, errorLog } from './config.js';

// Get the directory name of the current module for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetch parameters
 */
export interface FetchParams {
  url: string;
}

/**
 * Fetch result metadata
 */
export interface FetchMetadata {
  duration_ms: number;
  url: string;
  model: string;
  timestamp: string;
  cleanup_status: 'full' | 'turndown_only' | 'html_only';
}

/**
 * Successful fetch result
 */
export interface FetchSuccess {
  success: true;
  content: string;
  url: string;
  format: string;
  metadata: FetchMetadata;
}

/**
 * Failed fetch result
 */
export interface FetchError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
  fallback_html?: string;
}

/**
 * Fetch result type
 */
export type FetchResult = FetchSuccess | FetchError;

/**
 * Build the cleanup prompt from template
 */
async function buildCleanupPrompt(url: string, markdown: string): Promise<string> {
  const templatePath = path.join(__dirname, '..', 'prompts', 'fetch-cleanup-prompt.md');

  try {
    const template = await fs.readFile(templatePath, 'utf-8');

    const prompt = template
      .replace(/\{\{url\}\}/g, url)
      .replace(/\{\{markdown\}\}/g, markdown);

    return prompt;
  } catch (error) {
    debugLog('Cleanup prompt template not found, using fallback');
    return `Clean up the following markdown content from ${url}. Remove navigation, scripts, styles, fix code blocks, format tables properly, and expand any interactive UI components.\n\nMarkdown:\n${markdown}`;
  }
}

/**
 * Fetch HTML content using Gemini CLI
 *
 * Uses Gemini CLI with available MCP tools (browser, web_fetch) to fetch HTML content.
 * This handles JavaScript-rendered content and protected pages (Cloudflare, etc.).
 */
async function fetchHtmlFromGemini(url: string): Promise<{ html: string; model?: string }> {
  debugLog(`Fetching HTML from URL: ${url}`);

  const prompt = `Fetch and return the full HTML content of this webpage: ${url}

Use browser MCP or web_fetch tools if available. Make sure to wait for JavaScript to execute and get the fully rendered HTML. Return the raw HTML content without any modifications or explanations. 

Do not return any summary. Final message MUST be the raw HTML content.`;

      const result = await spawnGeminiCli(prompt, config.secondaryGeminiModel);

  const htmlMatch = result.match(/```html\s*([\s\S]*?)\s*```/) || result.match(/```xml\s*([\s\S]*?)\s*```/);
  const html = htmlMatch?.[1]?.trim() || result.trim();

  debugLog(`Fetched ${html.length} bytes of HTML`);

  const detectedModel = detectModelFromCliOutput(result);
  if (detectedModel) {
    debugLog(`Detected model: ${detectedModel}`);
  }

  return { html, model: detectedModel || undefined };
}

/**
 * Convert HTML to Markdown using Turndown library
 */
function convertHtmlToMarkdown(html: string): string {
  debugLog('Converting HTML to Markdown using Turndown');

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
  });

  const markdown = turndownService.turndown(html);
  debugLog(`Converted to ${markdown.length} bytes of Markdown`);

  return markdown;
}

/**
 * Clean up and optimize Markdown using Gemini CLI with retry logic
 */
async function cleanupMarkdownWithRetry(
  url: string,
  markdown: string,
  maxRetries?: number
): Promise<string> {
  const retries = maxRetries ?? config.jsonMaxRetries;
  debugLog(`Starting markdown cleanup with max ${retries} retries`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    debugLog(`Cleanup attempt ${attempt}/${retries}`);
    
    try {
      const prompt = await buildCleanupPrompt(url, markdown);
  const result = await spawnGeminiCli(prompt, config.secondaryGeminiModel);
      
      const cleanedMatch = result.match(/```markdown\s*([\s\S]*?)\s*```/);
      const cleaned = cleanedMatch?.[1]?.trim() || result.trim();
      
      debugLog(`Received ${cleaned.length} bytes from cleanup attempt ${attempt}`);
      
      if (cleaned.startsWith('CLEANUP_ERROR:')) {
        const errorMessage = cleaned.replace('CLEANUP_ERROR:', '').trim();
        warnLog(`Cleanup attempt ${attempt} failed: ${errorMessage}`);
        
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          debugLog(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } else {
        debugLog(`Cleanup attempt ${attempt} succeeded`);
        debugLog(`Cleaned markdown: ${cleaned.length} bytes`);
        return cleaned;
      }
    } catch (error) {
      warnLog(`Cleanup attempt ${attempt} threw error: ${(error as Error).message}`);
      
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        debugLog(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`All ${retries} cleanup attempts failed`);
}

/**
 * Main fetch function
 *
 * Fetches webpage content with the following steps:
 * 1. Validates Gemini CLI availability
 * 2. Fetches HTML content using Gemini CLI
 * 3. Converts HTML to Markdown using Turndown
 * 4. Cleans up Markdown using Gemini CLI AI
 * 5. Returns result with graceful fallbacks on failures
 *
 * @param params - Fetch parameters including URL
 * @returns Promise resolving to either a successful fetch result or an error
 */
export async function fetchWebpage(params: FetchParams): Promise<FetchResult> {
  const startTime = Date.now();
  const { url } = params;

  progressLog(`Starting webpage fetch for: "${url}"`);

  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'URL is required and must be a string',
      },
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_URL',
        message: 'Invalid URL format',
      },
    };
  }

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

  let html: string;
  let markdown: string;
  let cleanupStatus: FetchMetadata['cleanup_status'] = 'full';
  let detectedModel: string | undefined;

  try {
    const fetchResult = await fetchHtmlFromGemini(url);
    html = fetchResult.html;
    detectedModel = fetchResult.model;
  } catch (error) {
    const duration = Date.now() - startTime;
    errorLog(`HTML fetch failed after ${duration}ms: ${(error as Error).message}`);

    return {
      success: false,
      error: {
        code: 'HTML_FETCH_FAILED',
        message: 'Failed to fetch HTML content',
        details: (error as Error).message,
      },
    };
  }

  try {
    markdown = convertHtmlToMarkdown(html);
  } catch (error) {
    const duration = Date.now() - startTime;
    warnLog(`Markdown conversion failed after ${duration}ms, returning raw HTML`);

    return {
      success: true,
      content: html,
      url,
      format: 'html',
      metadata: {
        duration_ms: duration,
        url,
        model: config.secondaryGeminiModel || detectedModel || 'auto-detected',
        timestamp: new Date().toISOString(),
        cleanup_status: 'html_only',
      },
    };
  }

  try {
    markdown = await cleanupMarkdownWithRetry(url, markdown);
  } catch (error) {
    const duration = Date.now() - startTime;
    warnLog(`AI cleanup failed after ${duration}ms, returning Turndown-only markdown`);
    cleanupStatus = 'turndown_only';
  }

  const duration = Date.now() - startTime;
  progressLog(`Webpage fetch completed in ${duration}ms with status: ${cleanupStatus}`);

  return {
    success: true,
    content: markdown,
    url,
    format: 'markdown',
    metadata: {
      duration_ms: duration,
      url,
      model: config.geminiModel || detectedModel || 'auto-detected',
      timestamp: new Date().toISOString(),
      cleanup_status: cleanupStatus,
    },
  };
}
