## 1. Implementation
- [x] 1.1 Add turndown@7.2.2 dependency to package.json
- [x] 1.2 Create prompts/fetch-cleanup-prompt.md with comprehensive markdown cleaning instructions
- [x] 1.3 Create src/fetch.ts with main fetchWebpage function
- [x] 1.4 Implement fetchHtmlFromGemini() to use Gemini CLI for HTML fetching
- [x] 1.5 Implement convertHtmlToMarkdown() using Turndown library
- [x] 1.6 Implement cleanupMarkdownWithGemini() for AI-powered optimization
- [x] 1.7 Add error handling with graceful fallbacks at each stage
- [x] 1.8 Update src/server.ts to register fetch_webpage tool
- [x] 1.9 Add tool description matching existing search tools style
- [x] 1.10 Build and test the implementation

## 2. Additional Requirements (Post-Review)
- [x] 2.1 Add model detection to fetchHtmlFromGemini() for consistency with search tools
- [x] 2.2 Add HTML fallback content on HTML fetch failures (return partial HTML if available)
- [x] 2.3 Update metadata to include detected model name

## 3. Validation
- [x] 3.1 TypeScript type check passes (tsc --noEmit)
- [x] 3.2 Build succeeds (npm run build)
- [x] 3.3 OpenSpec validation passes (openspec validate --strict)
- [x] 3.4 Manual testing with simple static HTML pages
- [x] 3.5 Manual testing with JavaScript-rendered pages (via browser MCP)
- [x] 3.6 Manual testing with Cloudflare-protected pages
- [x] 3.7 Manual testing of error fallback behavior (Turndown failure, AI cleanup failure)
- [x] 3.8 Manual verification that metadata is correctly populated including model detection
- [x] 3.9 Manual confirmation that return structure matches existing search tools
