# Change: Add Webpage Fetch Tool

## Why

The current gemini-search-mcp server only provides search capabilities but lacks a direct webpage fetching tool. Users often need to fetch and read specific webpage content without performing a full search. Adding a `fetch_webpage` tool will enable agents to directly access and convert webpage content to clean markdown format.

## What Changes

- Add new MCP tool `fetch_webpage` that accepts a URL
- Implement HTML to Markdown conversion using Turndown library
- Use Gemini CLI to fetch HTML content (via browser MCP for JavaScript-heavy/protected pages)
- Use Gemini CLI to clean and optimize the converted Markdown
- Add error handling with graceful fallbacks (return raw HTML on conversion failure)
- Add cleanup prompt template for AI-powered markdown optimization
- Add model detection for consistency with search tools
- Add HTML fallback content on fetch failures

## Impact

- Affected specs: New capability `webpage-fetch`
- Affected code:
  - New file: `src/fetch.ts` (main implementation)
  - New file: `prompts/fetch-cleanup-prompt.md` (cleanup prompt)
  - Modified: `src/server.ts` (register new tool)
  - Modified: `package.json` (add turndown dependency)
- Dependencies: Add `turndown@7.2.2`
