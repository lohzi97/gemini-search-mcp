## 1. Core Package Changes

- [x] 1.1 Update `package.json` name field from `gemini-research-mcp` to `gemini-search-mcp`
- [x] 1.2 Update `package.json` bin field: `gemini-research-mcp` → `gemini-search-mcp`, `gemini-research-mcp-http` → `gemini-search-mcp-http`
- [x] 1.3 Update repository URL in `package.json`

## 2. Source Code Changes

- [x] 2.1 Update MCP server name in `src/server.ts`
- [x] 2.2 Update comments and logs in `src/index.ts`
- [x] 2.3 Update comments and logs in `src/http.ts`
- [x] 2.4 Update config directory path function in `src/config.ts`
- [x] 2.5 Update environment variable names in `src/config.ts` (`GEMINI_RESEARCH_*` → `GEMINI_SEARCH_*`)

## 3. Environment Variables

- [x] 3.1 Update `.env.example` header comment
- [x] 3.2 Rename `GEMINI_RESEARCH_TIMEOUT` → `GEMINI_SEARCH_TIMEOUT` in `.env.example`
- [x] 3.3 Rename `GEMINI_RESEARCH_CONFIG_DIR` → `GEMINI_SEARCH_CONFIG_DIR` in `.env.example`
- [x] 3.4 Update config directory path comments in `.env.example`
- [x] 3.5 Update binary name reference in `.env.example` comment

## 4. Documentation Files

- [x] 4.1 Update `README.md` - all occurrences of "gemini-research-mcp" and "Gemini Research MCP"
- [x] 4.2 Update `CLAUDE.md` - all references in architecture diagrams and examples
- [x] 4.3 Update `prd.md` - all product name references
- [x] 4.4 Update `PHASE_0_RESULTS.md` - all references
- [x] 4.5 Update `openspec/project.md` - project purpose, architecture diagram, config paths, env var documentation

## 5. Build Configuration

- [x] 5.1 Update comments in `tsup.config.ts`

## 6. License File

- [x] 6.1 Update copyright notice in `LICENSE`

## 7. Validation

- [x] 7.1 Run `openspec validate rename-to-gemini-search-mcp --strict`
- [x] 7.2 Run `npm run build` to verify build succeeds
- [x] 7.3 Search for any remaining occurrences of "gemini-research" (case-insensitive)
