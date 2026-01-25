## 1. Implementation

### 1.1 Configuration
- [x] 1.1.1 Update `src/config.ts` to change `geminiModel` default from `'gemini-2.5-flash'` to `undefined`
- [x] 1.1.2 Add `geminiCorrectionModel` config option (optional, no default)
- [x] 1.1.3 Add `GEMINI_CORRECTION_MODEL` env var to `.env.example` with documentation
- [x] 1.1.4 Update `.env.example` to clarify `GEMINI_MODEL` is now optional (auto-select when not set)

### 1.2 Startup Cleanup for Orphaned Temp Files
- [x] 1.2.1 Add `cleanupOrphanedTempFiles()` function to `src/utils.ts` that scans config directory for `temp-invalid-output-*.txt` files
- [x] 1.2.2 Log the number of orphaned files found and cleaned up (0 if none)
- [x] 1.2.3 Handle errors gracefully if config directory doesn't exist or isn't accessible
- [x] 1.2.4 Export `cleanupOrphanedTempFiles()` from `src/utils.ts`
- [x] 1.2.5 Call `cleanupOrphanedTempFiles()` in `src/index.ts` during server initialization (before starting MCP server)
- [x] 1.2.6 Call `cleanupOrphanedTempFiles()` in `src/http.ts` during server initialization (before starting HTTP server)

### 1.3 Update spawnGeminiCli for Optional Model
- [x] 1.3.1 Modify `spawnGeminiCli()` in `src/utils.ts` to accept optional model parameter
- [x] 1.3.2 When model is `undefined` or empty, don't pass `--model` flag to Gemini CLI
- [x] 1.3.3 When model is specified, pass `--model <value>` to Gemini CLI
- [x] 1.3.4 Update debug logging to show which model (or auto-select) is being used
- [x] 1.3.5 Add utility function `detectModelFromCliOutput(output: string): string | null` to parse model name from CLI stderr/debug output

### 1.4 Core JSON Correction Function
- [x] 1.4.1 Add `SEARCH_SCHEMA` and `DEEP_SEARCH_SCHEMA` constants to `src/utils.ts` (full JSON examples)
- [x] 1.4.2 Add `correctJsonOutput(invalidOutput: string, schema: string, model?: string)` function to `src/utils.ts`
- [x] 1.4.3 Write `invalidOutput` to temporary file (`temp-invalid-output-{unix-timestamp}.txt`) in config directory
- [x] 1.4.4 Create `prompts/correction-prompt.md` template with placeholders for schema and temp file path (implemented inline)
- [x] 1.4.5 Accept optional model parameter for correction (uses `config.geminiCorrectionModel` if set, otherwise undefined)
- [x] 1.4.6 Add distinct debug logging for correction attempts vs main search failures
- [x] 1.4.7 Clean up temporary file after correction attempt (both success and failure cases), log error if cleanup fails
- [x] 1.4.8 Request fenced ```json code blocks in correction prompt (consistent with other prompts)
- [x] 1.4.9 Accept schema as full JSON example string parameter (passed from schema constants)

### 1.5 Refactor Shared Retry Logic
- [x] 1.5.1 Create new shared function `executeResearchWithCorrection(prompt: string, schema: string, model?: string)` in `src/utils.ts`
- [x] 1.5.2 Consolidate logic from `executeResearchWithRetry()` and `executeSearchRound()` into single function
- [x] 1.5.3 Implement retry flow: main search → if invalid, single correction attempt → if invalid, next cycle
- [x] 1.5.4 Accept optional model parameter for main search (uses `config.geminiModel` if set, otherwise undefined)
- [x] 1.5.5 Keep exponential backoff (1s, 2s, 5s) between retry cycles
- [x] 1.5.6 Keep maximum 3 retry cycles
- [x] 1.5.7 Return detected model name from CLI output (when model is undefined) for metadata field

### 1.6 Update Search Module
- [x] 1.6.1 Update `src/search.ts` to use new shared `executeResearchWithCorrection()` function
- [x] 1.6.2 Pass `SEARCH_SCHEMA` constant to the function
- [x] 1.6.3 Pass `config.geminiModel` (or undefined) for main search
- [x] 1.6.4 Update `metadata.model` field to use configured model or detected model from CLI
- [x] 1.6.5 Old `executeResearchWithRetry()` kept as legacy alias for backwards compatibility

### 1.7 Update Deep Search Module
- [x] 1.7.1 Refactored `executeSearchRound()` function in `src/deep-search.ts` to wrap shared function
- [x] 1.7.2 Update `src/deep-search.ts` to use shared `executeResearchWithCorrection()` function
- [x] 1.7.3 Pass `DEEP_SEARCH_SCHEMA` constant to the function
- [x] 1.7.4 Pass `config.geminiModel` (or undefined) for main search rounds
- [x] 1.7.5 Update `metadata.model` field to use configured model or detected model from CLI
- [x] 1.7.6 Verify all round executions use the shared function consistently

### 1.8 Testing
- [x] 1.8.1 Test `search` tool with no model env vars (verify auto-select)
- [x] 1.8.2 Test `search` tool with `GEMINI_MODEL` set (verify specified model used)
- [x] 1.8.3 Test `search` tool with both models set (verify independent configuration)
- [x] 1.8.4 Test `search` tool with intentionally malformed JSON output
- [x] 1.8.5 Test `deep_search` tool with same model configuration scenarios
- [x] 1.8.6 Test `deep_search` tool with intentionally malformed JSON output
- [x] 1.8.7 Verify correction step successfully fixes common JSON issues for both tools
- [x] 1.8.8 Verify full retry cycle (main + correction × 3) works correctly
- [x] 1.8.9 Verify error handling when all attempts are exhausted
- [x] 1.8.10 Verify temporary file is created in config directory during correction
- [x] 1.8.11 Verify temporary file is cleaned up after correction (both success and failure)
- [x] 1.8.12 Verify distinct log messages for main search vs correction failures
- [x] 1.8.13 Verify `metadata.model` field contains correct model name (configured or detected)
- [x] 1.8.14 Test startup cleanup with orphaned temp files (verify files are removed)
- [x] 1.8.15 Test startup cleanup when no orphaned files exist (verify graceful handling)

## 2. Documentation
- [x] 2.1 Update relevant comments in code describing new correction flow
- [x] 2.2 Update `.env.example` with `GEMINI_MODEL` and `GEMINI_CORRECTION_MODEL` documentation
