# Change: Add JSON Correction Fallback for Search Tools

## Why

Both `search` and `deep_search` tools experience ~50% failure rate due to LLM outputting non-JSON formatted responses. When this happens, the current retry logic simply retries the same research prompt, which is inefficient because:

1. The LLM may have produced excellent research content, just not in valid JSON format
2. Re-running the entire search wastes time and API calls
3. The non-deterministic nature of LLMs means valid JSON may not be produced even after multiple retries

A more efficient approach is to add a dedicated "JSON correction" step that uses a separate LLM call to convert the invalid output into proper JSON format.

## What Changes

- Add `correctJsonOutput(invalidOutput, schema, model?)` function to `src/utils.ts` that spawns a separate Gemini CLI call with a focused "fix this JSON" prompt
  - Writes `invalidOutput` to a temporary file (`temp-invalid-output-{unix-timestamp}.txt`) in the config directory (`~/.config/gemini-search-mcp/` or equivalent)
  - The correction prompt instructs Gemini CLI to read from that file
  - Cleans up the temporary file after correction attempt
  - Note: Gemini CLI runs with user permissions, so it already has read/write access to the config directory
- Add schema constants `SEARCH_SCHEMA` and `DEEP_SEARCH_SCHEMA` in `src/utils.ts` (full JSON examples for correction prompt)
- Add startup cleanup function `cleanupOrphanedTempFiles()` that runs on server initialization to remove any leftover `temp-invalid-output-*.txt` files from previous crashes
- Add new config option `GEMINI_CORRECTION_MODEL` (optional) for the correction task
- **Refactor**: Consolidate `executeSearchRound()` in `src/deep-search.ts` and `executeResearchWithRetry()` in `src/utils.ts` into a single shared function `executeResearchWithCorrection(prompt, schema, model?)` to eliminate duplication
- Update `spawnGeminiCli()` to accept optional model parameter (if not provided, don't pass `--model` flag - let Gemini CLI auto-select)
- **Change config defaults**: Change `geminiModel` default from `'gemini-2.5-flash'` to `undefined` to distinguish "not set" from "explicitly set"
- Update retry flow with new behavior:
  1. Run main search prompt (uses `GEMINI_MODEL` if set, otherwise auto-select)
  2. If JSON invalid, attempt correction prompt (uses `GEMINI_CORRECTION_MODEL` if set, otherwise auto-select)
  3. Single correction attempt per cycle - if correction fails, proceed to next retry cycle
  4. Maximum 3 retry cycles
- Add `prompts/correction-prompt.md` template with placeholders for schema and temp file path
- **Error logging**: Use distinct debug log messages for "Main search failed" vs "JSON correction failed" to aid troubleshooting
- **BREAKING**: Change default `GEMINI_MODEL` behavior - when not set, no `--model` flag is passed (allows CLI auto-selection). Users who relied on implicit `gemini-2.5-flash` default should explicitly set `GEMINI_MODEL=gemini-2.5-flash`. This breaking change is acceptable as documented in migration notes.

**Model Selection Behavior:**
- No env vars set → Don't pass `--model` to Gemini CLI (let it auto-select)
- `GEMINI_MODEL` set → Use specified model for search tasks
- `GEMINI_CORRECTION_MODEL` set → Use specified model for JSON correction tasks
- Each model can be configured independently

**Metadata Model Field:**
- When `GEMINI_MODEL` is set, store the configured model name in `metadata.model`
- When not set (auto-select), attempt to detect the actual model from CLI output for `metadata.model`
- If detection fails, use the placeholder value `"auto-detected"`

**JSON Format Standardization:**
- All prompts (search, deep-search, verify, correction) request fenced ```json code blocks
- The existing `extractJsonFromOutput()` function handles this format correctly (Strategy 1: fenced blocks, Strategy 2: raw objects)
- Correction prompt will follow the same fenced block convention for consistency

## Impact

- Affected specs: `search` and `deep-search` capabilities (MODIFIED - JSON retry logic and model selection)
- Affected code:
  - Modified `src/utils.ts` - Add `correctJsonOutput()` with temp file handling, add schema constants, add `cleanupOrphanedTempFiles()`, update `spawnGeminiCli()` for optional model, refactor shared retry function
  - Modified `src/deep-search.ts` - Remove `executeSearchRound()`, use shared function from utils
  - Modified `src/search.ts` - Uses updated shared function (no direct changes needed)
  - Modified `src/config.ts` - Update config to handle optional model values
  - Modified `src/server.ts` - Call `cleanupOrphanedTempFiles()` during server initialization
  - Added `prompts/correction-prompt.md` - Template for JSON correction prompt with temp file reference
