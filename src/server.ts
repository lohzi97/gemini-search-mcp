/**
 * MCP Server implementation for Gemini Research MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { deepResearch, type ResearchParams } from './deep-research.js';
import { debugLog, progressLog, warnLog, errorLog, config } from './config.js';

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  debugLog('Creating MCP server');

  // Create the MCP server
  const server = new McpServer(
    {
      name: 'gemini-research-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {},
    }
  );

  // Register the deep_research tool
  server.tool(
    'deep_research',
    `Delegates a complex research task to a specialized autonomous Gemini agent.

The agent has access to:
- Live Google Search via Grounding
- Firecrawl web scraping tools for JavaScript rendering and clean Markdown output

Use this for:
- Deep dives into technical topics
- Literature reviews and research synthesis
- Current events and trending topics
- Comprehensive analysis from multiple sources
- Questions requiring full page content (not just snippets)

The agent will:
1. Search for relevant sources
2. Scrape full page content (with JS rendering if Firecrawl is available)
3. Iterate until comprehensive information is gathered
4. Synthesize findings into a structured report

If Firecrawl is unavailable, the agent gracefully degrades to Google Search only.`,
    {
      topic: z.string().describe('The specific research question or topic. Be detailed for better results.'),
      depth: z
        .enum(['concise', 'detailed'])
        .default('detailed')
        .describe('The desired depth of the final report.'),
    },
    async ({ topic, depth }) => {
      debugLog(`deep_research called: topic="${topic}", depth="${depth}"`);

      try {
        const params: ResearchParams = { topic, depth };
        const result = await deepResearch(params);

        if (result.success) {
          progressLog(`Research successful: "${topic}"`);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } else {
          errorLog(`Research failed: ${result.error.message}`);
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
        errorLog(`Unexpected error in deep_research: ${err.message}`);
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
