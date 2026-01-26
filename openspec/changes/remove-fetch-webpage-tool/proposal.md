# Change: Remove fetch_webpage Tool

## Why

The `fetch_webpage` tool was designed to fetch webpage content and convert it to clean markdown. However, we discovered a fundamental issue: using Gemini CLI to fetch raw HTML content is unreliable because:

1. **Output Truncation**: The Gemini CLI has token limits that cause HTML content to be truncated mid-stream (observed in debug.log showing HTML cut off mid-attribute)
2. **No Continuation Support**: There's no built-in mechanism to detect and resume from truncation
3. **Complexity vs Benefit**: To properly handle webpage fetching (browser lifecycle, anti-bot detection, JavaScript execution, connection management), we'd need significant infrastructure (Puppeteer, environment variables, browser instance management)

The project's goal is to focus on **web search** capabilities. Letting specialized MCPs (like Playwright MCP, Chrome DevTools MCP) handle webpage reading is a better architectural decision:
- Separation of concerns
- Each MCP does one thing well
- Users can choose the best webpage fetcher for their needs
- Reduces maintenance burden

## What Changes

### Core Removal
- **Delete file**: `src/fetch.ts` (326 lines) - Complete fetch_webpage implementation
- **Delete file**: `prompts/fetch-html-prompt.md` (36 lines) - HTML fetching prompt template
- **Delete file**: `prompts/fetch-cleanup-prompt.md` (86 lines) - Markdown cleanup prompt template
- **Modify**: `src/server.ts` - Remove fetch_webpage tool registration and imports
- **Modify**: `src/server.ts` - Update JSDoc comment in `createServer()` function to reflect 2 tools instead of 3
- **Modify**: `src/server.ts` - Update hardcoded version from 0.1.0 to 0.2.0 to match package.json
- **Modify**: `src/utils.ts` - Remove `--allowed-mcp-server-names` and `chrome-devtools` argument (line 224)
- **Modify**: `src/config-setup.ts` - Remove chrome-devtools MCP server configuration block (lines 73-79)
- **Modify**: `package.json` - Remove turndown dependency and @types/turndown
- **Modify**: `package.json` - Bump version from 0.1.9 to 0.2.0

### Configuration Changes
- **Modify**: `.env.example` - Update SECONDARY_GEMINI_MODEL description (remove webpage fetching reference)
- **Modify**: `templates/gemini-settings.json.template` - Remove `chrome-devtools` from `allowedMcpServerNames`
  - **Rationale**: chrome-devtools is no longer needed for webpage fetching and slows down Gemini CLI startup

### Documentation Changes
- **Modify**: `README.md` - Update to reflect 2 tools instead of 3, remove fetch_webpage documentation
- **Modify**: `openspec/project.md` - Remove fetch_webpage references, fetch.ts file structure, webpage fetch flow, and Turndown from Tech Stack
- **Modify**: `AGENTS.md` - Remove fetch.ts from file organization section

### OpenSpec Records
- **Preserve**: `openspec/changes/add-fetch-webpage-tool/` - Keep as historical record of why it was added
- **Create**: New change proposal for removal (this document)

### Version Bump
- **Version**: `0.1.9` → `0.2.0`
- **Breaking Change**: Removing a public tool (`fetch_webpage`) is a breaking change
- **SemVer**: Major version bump required

## Impact

### Positive Impact
- **Simpler Codebase**: Removes 326+ lines of complex HTML fetching and cleanup logic
- **Faster Startup**: Removing chrome-devtools from allowedMcpServerNames reduces Gemini CLI startup time
- **Clearer Focus**: MCP server focuses exclusively on search capabilities
- **Better Separation**: Webpage reading handled by specialized MCPs with better capabilities

### Negative Impact
- **Breaking Change**: Users relying on fetch_webpage will need to switch to alternative MCPs (e.g., Playwright MCP)
- **No Built-in Fallback**: Clients must explicitly configure a webpage fetching MCP
- **Dependency Reduction**: Reduced dependency count (turndown, @types/turndown removed)

### Affected Specs
- **Removed**: `webpage-fetch` capability from openspec/specs/
- **Updated**: Server will only expose 2 tools: `search`, `deep_search`

### Migration Path for Users
Users currently using fetch_webpage should:
1. Install a dedicated webpage fetching MCP (e.g., `playwright-mcp`, `chrome-devtools-mcp`)
2. Update their Claude Desktop/Claude Code configuration to include the new MCP
3. Use the webpage fetching MCP directly instead of fetch_webpage

## Implementation Checklist

See `tasks.md` for detailed implementation steps.

## Testing Checklist

After removal:
- [ ] Build succeeds: `npm run build`
- [ ] Type check passes: `tsc --noEmit`
- [ ] No imports to deleted files remain
- [ ] Server exposes exactly 2 tools: `search`, `deep_search`
- [ ] No turndown references in code
- [ ] No chrome-devtools references in code
- [ ] chrome-devtools removed from generated gemini-settings.json
- [ ] Firecrawl MCP still works correctly with search/deep_search tools
- [ ] Documentation updated correctly
- [ ] Gemini CLI startup is faster (manual verification)
