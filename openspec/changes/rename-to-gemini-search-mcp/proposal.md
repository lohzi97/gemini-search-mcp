# Change: Rename project to gemini-search-mcp

## Why

The current name `gemini-research-mcp` is inconsistent with the actual tool names (`search` and `deep_search`) and creates confusion for consuming AI agents. The package name should clearly reflect that this MCP server provides **web search** capabilities via the Gemini CLI, not generic "research" which implies broader analytical work. This rename improves discoverability and sets accurate expectations for agents consuming this MCP server.

## What Changes

- **BREAKING**: Package name: `gemini-research-mcp` → `gemini-search-mcp`
- **BREAKING**: Binary names: `gemini-research-mcp` → `gemini-search-mcp`, `gemini-research-mcp-http` → `gemini-search-mcp-http`
- **BREAKING**: Config directory paths: `~/.config/gemini-research-mcp/` → `~/.config/gemini-search-mcp/` (all platforms)
- **BREAKING**: MCP server name: `gemini-research-mcp` → `gemini-search-mcp`
- Documentation updates: README.md, CLAUDE.md, prd.md, openspec/project.md, PHASE_0_RESULTS.md
- Environment variable names: `GEMINI_RESEARCH_*` → `GEMINI_SEARCH_*`
- Repository URLs: Update placeholder GitHub URLs
- License copyright notice
- Build configuration comments
- All source code comments and debug logs referencing the old name

## Impact

- Affected specs: `project` (project context and conventions)
- Affected code: All source files (src/*.ts), package.json, tsup.config.ts
- Affected documentation: README.md, CLAUDE.md, prd.md, openspec/project.md, PHASE_0_RESULTS.md
- Migration: Users will need to:
  1. Reinstall with new package name
  2. Update config directory location (or migrate existing config)
  3. Update environment variable names
  4. Update MCP client configuration (binary names)
