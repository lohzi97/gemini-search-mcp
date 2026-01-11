## 1. Implementation

### 1.1 Core Implementation
- [x] 1.1.1 Create `src/search.ts` with single-round search function
- [x] 1.1.2 Create `src/deep-search.ts` with iterative search and verification
- [x] 1.1.3 Export helper functions from `deep-research.ts` for reuse

### 1.2 Prompt Templates
- [x] 1.2.1 Create `prompts/search-prompt.md` for single-round search
- [x] 1.2.2 Create `prompts/deep-search-prompt.md` for initial deep research
- [x] 1.2.3 Create `prompts/verify-prompt.md` for verification rounds

### 1.3 Server Integration
- [x] 1.3.1 Update `src/config.ts` with new config options (max iterations, etc.)
- [x] 1.3.2 Update `src/server.ts` to register `search` and `deep_search` tools

### 1.4 Testing
- [x] 1.4.1 Test `search` tool with simple query
- [x] 1.4.2 Test `deep_search` tool with complex query
- [x] 1.4.3 Verify backward compatibility of `deep_research` tool

## 2. Documentation
- [x] 2.1 Update README.md with new tool descriptions
- [x] 2.2 Update .env.example with new configuration options
