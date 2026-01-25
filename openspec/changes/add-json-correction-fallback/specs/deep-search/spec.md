# Deep Search Capability

## MODIFIED Requirements

### Requirement: Model Selection for Search Rounds and Correction

The `deep_search` tool SHALL support optional model configuration for both main search rounds and JSON correction tasks. When no model is specified, the Gemini CLI shall auto-select the model.

#### Scenario: No model specified - auto-selection
- **WHEN** neither `GEMINI_MODEL` nor `GEMINI_CORRECTION_MODEL` environment variables are set
- **THEN** the server spawns Gemini CLI without passing `--model` flag
- **AND** the Gemini CLI auto-selects the appropriate model for both search rounds and correction

#### Scenario: Main search model specified
- **WHEN** `GEMINI_MODEL` environment variable is set
- **THEN** the server uses the specified model for main search rounds
- **AND** passes `--model <value>` to the Gemini CLI for search round spawns

#### Scenario: Correction model specified
- **WHEN** `GEMINI_CORRECTION_MODEL` environment variable is set
- **THEN** the server uses the specified model for JSON correction tasks
- **AND** passes `--model <value>` to the Gemini CLI for correction spawns

#### Scenario: Both models specified
- **WHEN** both `GEMINI_MODEL` and `GEMINI_CORRECTION_MODEL` are set
- **THEN** the server uses each specified model for its respective task
- **AND** each task uses its independently configured model

### Requirement: JSON Retry Logic with Correction Fallback

The `deep_search` tool SHALL implement a two-stage retry strategy for JSON parsing failures: first attempt correction on the invalid output, then retry the entire cycle if correction also fails.

#### Scenario: Initial attempt - main search prompt
- **WHEN** a search round begins
- **THEN** the server runs the main research prompt via Gemini CLI
- **AND** attempts to extract and validate JSON from the output

#### Scenario: JSON parsing failure - correction attempt
- **WHEN** the main search returns output that cannot be parsed as valid JSON
- **THEN** the server immediately attempts JSON correction
- **AND** writes the invalid output to a temporary file (`temp-invalid-output-{unix-timestamp}.txt`) in the config directory
- **AND** spawns a new Gemini CLI with a correction prompt
- **AND** the correction prompt includes:
  - The expected JSON schema as a full JSON example (success, verified, report, metadata fields)
  - The path to the temporary file containing the invalid output
  - Instructions to read from that file, extract research information, and format properly
- **AND** logs a distinct "JSON correction failed" error if correction fails

#### Scenario: Correction success
- **WHEN** the correction step successfully produces valid JSON
- **THEN** the server accepts the corrected result
- **AND** proceeds with the search round (no additional retries needed)

#### Scenario: Correction failure - retry cycle
- **WHEN** the correction step also fails to produce valid JSON
- **THEN** the server retries the entire cycle (main search → correction if needed)
- **AND** waits with exponential backoff: 1s, 2s, then 5s
- **AND** after 3 total cycles, throws an error if all failed

#### Scenario: All attempts exhausted
- **WHEN** all retry cycles (main search + correction) fail
- **THEN** the server returns an error with code `EXECUTION_ERROR`
- **AND** the error message indicates all retry and correction attempts were exhausted

### Requirement: JSON Correction Prompt

The JSON correction prompt SHALL be a focused, schema-aware prompt that instructs the LLM to convert invalid output into the proper JSON format.

#### Scenario: Correction prompt content
- **WHEN** the correction prompt is sent to Gemini CLI
- **THEN** the prompt instructs Gemini to:
  - Act as a JSON formatter
  - Read the invalid output from the specified temporary file
  - Extract research information from that file
  - Format into the exact JSON schema provided
  - Return JSON in fenced ```json code blocks (consistent with other prompts)
- **AND** the prompt includes a full JSON schema example (passed as parameter to support both search and deep_search schemas)

#### Scenario: Correction prompt with invalid output file
- **WHEN** building the correction prompt
- **THEN** the server has written the invalid output to a temporary file (`temp-invalid-output-{unix-timestamp}.txt`)
- **AND** the prompt includes the full path to that temporary file
- **AND** instructs Gemini to read from that file and extract research content

#### Scenario: Temporary file cleanup
- **WHEN** the correction attempt completes (success or failure)
- **THEN** the server deletes the temporary file
- **AND** logs an error if cleanup fails

### Requirement: Startup Cleanup of Orphaned Temp Files

The server SHALL clean up any orphaned temporary files from previous crashes during initialization to prevent disk space accumulation.

#### Scenario: Startup cleanup with orphaned files
- **WHEN** the server starts and orphaned `temp-invalid-output-*.txt` files exist in the config directory
- **THEN** the server scans the config directory for files matching the pattern
- **AND** deletes all matching orphaned files
- **AND** logs the number of files cleaned up

#### Scenario: Startup cleanup with no orphaned files
- **WHEN** the server starts and no orphaned files exist
- **THEN** the server scans the config directory
- **AND** logs that 0 files were cleaned up
- **AND** proceeds normally with server initialization

#### Scenario: Startup cleanup with inaccessible config directory
- **WHEN** the server starts and the config directory doesn't exist or isn't accessible
- **THEN** the server handles the error gracefully
- **AND** logs a warning but continues with server initialization

### Requirement: Metadata Model Field Detection

The `deep_search` tool SHALL populate the `metadata.model` field with the actual model used, whether explicitly configured or auto-selected.

#### Scenario: Model explicitly configured
- **WHEN** `GEMINI_MODEL` environment variable is set
- **THEN** the server stores the configured model name in `metadata.model`

#### Scenario: Model auto-selected with successful detection
- **WHEN** `GEMINI_MODEL` is not set and model detection from CLI output succeeds
- **THEN** the server stores the detected model name in `metadata.model`

#### Scenario: Model auto-selected with failed detection
- **WHEN** `GEMINI_MODEL` is not set and model detection from CLI output fails
- **THEN** the server stores the placeholder value `"auto-detected"` in `metadata.model`
