# Change: Add `search` and `deep_search` MCP Tools

## Why

The current `deep_research` tool only provides a single-shot research experience. Users need more granular control:
- Quick single-round searches for simple queries
- Iterative deep searches with verification loops for complex topics
- Better orchestration of the research process by the MCP server

## What Changes

- Add `search` tool: Single-round search (Google search once → fetch promising sites → return result)
- Add `deep_search` tool: Multi-round iterative search with verification loop
- Keep existing `deep_research` tool for backward compatibility

**BREAKING**: None (additive change)

## Impact

- Affected specs: New `search` and `deep-search` capabilities
- Affected code:
  - New `src/search.ts` - Single-round search implementation
  - New `src/deep-search.ts` - Multi-round iterative search implementation
  - Modified `src/server.ts` - Register new tools
  - Modified `src/config.ts` - Add configuration for deep search iterations
  - New prompt templates in `prompts/`
