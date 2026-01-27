## 1. Core Implementation
- [x] 1.1 Delete `src/fetch.ts` file (entire file with fetchWebpage implementation)
- [x] 1.2 Delete `prompts/fetch-html-prompt.md` file
- [x] 1.3 Delete `prompts/fetch-cleanup-prompt.md` file
- [x] 1.4 Modify `src/server.ts` - Remove line 9: `import { fetchWebpage, type FetchParams } from './fetch.js';`
- [x] 1.5 Modify `src/server.ts` - Remove lines 195-271: entire fetch_webpage tool registration block
- [x] 1.6 Modify `src/server.ts` - Update JSDoc comment in `createServer()` function to reflect 2 tools instead of 3
- [x] 1.7 Modify `src/server.ts` - Update hardcoded version from `"0.1.0"` to `"0.2.0"` on line 28
- [x] 1.8 Modify `package.json` - Remove `"turndown": "^7.2.2",` from dependencies
- [x] 1.9 Modify `package.json` - Remove `"@types/turndown": "^5.0.4",` from devDependencies
- [x] 1.10 Bump version in `package.json` from `"0.1.9"` to `"0.2.0"`
- [x] 1.11 Modify `src/utils.ts` - Remove line 224: `args.push('chrome-devtools');`
- [x] 1.12 Modify `src/config-setup.ts` - Remove lines 73-79: chrome-devtools MCP server configuration block

## 2. Configuration Changes
- [x] 2.1 Modify `.env.example` - Update SECONDARY_GEMINI_MODEL comment (around lines 16-18)
  - Remove reference to "webpage fetching"
  - Update to: "Used for: JSON correction in search/deep_search"
- [x] 2.2 Modify `templates/gemini-settings.json.template` - Remove entire "chrome-devtools" MCP server configuration block
  - This reduces Gemini CLI startup time
  - Firecrawl configuration should remain unchanged

## 3. Documentation Updates
- [x] 3.1 Modify `README.md` - Find and replace "Three Research Modes" with "Two Research Modes" (around line 16)
- [x] 3.2 Modify `README.md` - Find and update verification text to remove `fetch_webpage` reference (around line 122)
  - Change: "confirm `search`, `deep_search`, and `fetch_webpage` appear" to "confirm `search` and `deep_search` appear"
- [x] 3.3 Modify `README.md` - Remove entire "3. `fetch_webpage` - Direct Webpage Fetching" section (around lines 155-166)
- [x] 3.4 Modify `openspec/project.md` - Update goal statement to only mention `search` and `deep_search` (around line 14)
- [x] 3.5 Modify `openspec/project.md` - Remove "Graceful Fallback for Webpage Fetch" pattern (around line 77)
- [x] 3.6 Modify `openspec/project.md` - Remove `fetch.ts` from file structure section (around line 91)
- [x] 3.7 Modify `openspec/project.md` - Remove `fetch-cleanup-prompt.md` from file structure section (around line 100)
- [x] 3.8 Modify `openspec/project.md` - Remove `fetch_webpage` from MCP tool list (around line 119)
- [x] 3.9 Modify `openspec/project.md` - Remove entire "Webpage Fetch" flow section (around lines 137-143)
- [x] 3.10 Modify `openspec/project.md` - Remove Turndown from Tech Stack section (around line 28)
- [x] 3.11 Modify `AGENTS.md` - Remove `src/fetch.ts` from file organization section (around line 135)

## 4. OpenSpec Records
- [x] 4.1 Preserve `openspec/changes/add-fetch-webpage-tool/` directory as historical record (DO NOT DELETE)

## 5. Validation
- [x] 5.1 TypeScript type check passes: `tsc --noEmit`
- [x] 5.2 Build succeeds: `npm run build`
- [x] 5.3 Verify no imports to deleted files remain (grep for fetch.ts, FetchParams, FetchResult)
- [x] 5.4 Verify server exposes exactly 2 tools: `search` and `deep_search` (test with MCP client or check dist/server.js)
- [x] 5.5 Verify no turndown references remain in code (grep for turndown)
- [x] 5.6 Verify no chrome-devtools references remain in code (grep for chrome-devtools)
- [x] 5.7 Verify chrome-devtools removed from generated gemini-settings.json (manual check or automated)
- [x] 5.8 Verify Firecrawl MCP configuration still works correctly with search/deep_search tools
- [x] 5.9 Manual verification of documentation updates
- [x] 5.10 Manual verification that Gemini CLI startup is faster (compare startup time before/after)

## 6. Final Review
- [x] 6.1 Review all changes match proposal.md
- [x] 6.2 Ensure package.json version is bumped to 0.2.0
- [x] 6.3 Ensure server.ts version is synchronized to 0.2.0
- [x] 6.4 Confirm no orphaned references to fetch_webpage or chrome-devtools
- [x] 6.5 Confirm no orphaned references to turndown
- [x] 6.6 Check that clean build produces no errors
