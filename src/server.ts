/**
 * MCP Server implementation for Gemini Search MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { search, type SearchParams } from './search.js';
import { deepSearch, type DeepSearchParams } from './deep-search.js';
import { fetchWebpage, type FetchParams } from './fetch.js';
import { debugLog, progressLog, errorLog } from './config.js';

/**
 * Create and configure the MCP server
 *
 * Creates an MCP server instance with `search` and `deep_search` tools registered.
 * The tools accept research queries and delegate to a Gemini CLI agent,
 * returning structured research reports with metadata.
 *
 * @returns A configured McpServer instance ready to connect to a transport
 */
export function createServer(): McpServer {
  debugLog('Creating MCP server');

  // Create the MCP server
  const server = new McpServer(
    {
      name: 'gemini-search-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {},
    }
  );

  // Register the search tool
  server.tool(
    'search',
    `Performs a single-round search for quick answers.

This is a lighter, faster option for simple queries that don't require multiple iterations.

Use this for:
- Quick fact-finding
- Simple questions that can be answered with one search
- Getting current information on a topic
- When you need results quickly

The tool will:
1. Search Google once for relevant sources
2. Fetch content from the most promising results
3. Return a concise report`,
    {
      query: z.string().describe('The search query or question.'),
    },
    async ({ query }) => {
      debugLog(`search called: query="${query}"`);

      try {
        const params: SearchParams = { query };
        const result = await search(params);

        if (result.success) {
          progressLog(`Search successful: "${query}"`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } else {
          errorLog(`Search failed: ${result.error.message}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        const err = error as Error;
        errorLog(`Unexpected error in search: ${err.message}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: 'UNEXPECTED_ERROR',
                    message: err.message,
                    details: err.stack,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register the deep_search tool
  server.tool(
    'deep_search',
    `Performs multi-round iterative deep search with verification loops.

This provides server-orchestrated iterations with intermediate result passing for comprehensive research.

Use this for:
- Complex topics requiring thorough verification
- Research that benefits from multiple validation rounds
- When you need to track the research process through iterations
- Comprehensive analysis with verification of findings

The tool will:
1. Perform initial research with 5-perspective analysis (technical, historical, current trends, expert opinions, statistics)
2. Iteratively verify and enhance results through multiple rounds
3. Complete when verified or max iterations (default: 5) is reached
4. Return final result with metadata including all sources and round-by-round progress`,
    {
      topic: z.string().describe('The specific research question or topic. Be detailed for better results.'),
      maxIterations: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum number of verification rounds (default: 5, max: 10).'),
    },
    async ({ topic, maxIterations }) => {
      debugLog(`deep_search called: topic="${topic}", maxIterations="${maxIterations ?? 'default'}"`);

      try {
        const params: DeepSearchParams = { topic, maxIterations };
        const result = await deepSearch(params);

        if (result.success) {
          const status = result.verified ? 'verified' : 'completed max iterations';
          progressLog(`Deep search ${status}: "${topic}"`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } else {
          errorLog(`Deep search failed: ${result.error.message}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        const err = error as Error;
        errorLog(`Unexpected error in deep_search: ${err.message}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: 'UNEXPECTED_ERROR',
                    message: err.message,
                    details: err.stack,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register the fetch_webpage tool
  server.tool(
    'fetch_webpage',
    `Fetches and converts a webpage to clean markdown format.

This tool directly accesses webpage content without performing a search. It handles JavaScript-rendered pages and protected sites (e.g., Cloudflare) via browser MCP tools.

Use this for:
- Reading specific webpage content directly
- Accessing documentation or articles when you know the URL
- Getting the full content of a page without search

The tool will:
1. Fetch HTML content using Gemini CLI (with browser MCP for JS/protected pages)
2. Convert HTML to Markdown using Turndown library
3. Clean up the markdown with AI to remove navigation, fix code blocks, etc.
4. Return clean markdown with metadata including cleanup status

If the conversion or cleanup fails, the tool gracefully falls back to raw HTML or Turndown-only markdown.`,
    {
      url: z.string().describe('The URL of the webpage to fetch'),
    },
    async ({ url }) => {
      debugLog(`fetch_webpage called: url="${url}"`);

      try {
        const params: FetchParams = { url };
        const result = await fetchWebpage(params);

        if (result.success) {
          progressLog(`Webpage fetch successful: "${url}"`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } else {
          errorLog(`Webpage fetch failed: ${result.error.message}`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        const err = error as Error;
        errorLog(`Unexpected error in fetch_webpage: ${err.message}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: 'UNEXPECTED_ERROR',
                    message: err.message,
                    details: err.stack,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    }
  );

  debugLog('MCP server created successfully');
  return server;
}

/**
 * Handle server shutdown gracefully
 *
 * Registers SIGTERM and SIGINT handlers to close the server gracefully.
 * Ensures proper cleanup of resources before process exit.
 *
 * @param server - The MCP server instance to close on shutdown
 */
export function setupShutdownHandlers(server: McpServer): void {
  const shutdown = async (signal: string) => {
    debugLog(`Received ${signal}, shutting down gracefully`);
    try {
      await server.close();
      debugLog('Server closed successfully');
      process.exit(0);
    } catch (error) {
      errorLog(`Error during shutdown: ${error}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
