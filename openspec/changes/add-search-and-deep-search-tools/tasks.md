## 1. Implementation

### 1.1 Core Implementation
- [ ] 1.1.1 Create `src/search.ts` with single-round search function
- [ ] 1.1.2 Create `src/deep-search.ts` with iterative search and verification
- [ ] 1.1.3 Export helper functions from `deep-research.ts` for reuse

### 1.2 Prompt Templates
- [ ] 1.2.1 Create `prompts/search-prompt.md` for single-round search
- [ ] 1.2.2 Create `prompts/deep-search-prompt.md` for initial deep research
- [ ] 1.2.3 Create `prompts/verify-prompt.md` for verification rounds

### 1.3 Server Integration
- [ ] 1.3.1 Update `src/config.ts` with new config options (max iterations, etc.)
- [ ] 1.3.2 Update `src/server.ts` to register `search` and `deep_search` tools

### 1.4 Testing
- [ ] 1.4.1 Test `search` tool with simple query
- [ ] 1.4.2 Test `deep_search` tool with complex query
- [ ] 1.4.3 Verify backward compatibility of `deep_research` tool

## 2. Documentation
- [ ] 2.1 Update README.md with new tool descriptions
- [ ] 2.2 Update .env.example with new configuration options
