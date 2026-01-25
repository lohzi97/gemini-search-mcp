# Search Capability

## MODIFIED Requirements

### Requirement: Model Selection for Search and Correction

The `search` tool SHALL support optional model configuration for both main search and JSON correction tasks. When no model is specified, the Gemini CLI shall auto-select the model.

#### Scenario: No model specified - auto-selection
- **WHEN** neither `GEMINI_MODEL` nor `GEMINI_CORRECTION_MODEL` environment variables are set
- **THEN** the server spawns Gemini CLI without passing `--model` flag
- **AND** the Gemini CLI auto-selects the appropriate model for both search and correction

#### Scenario: Main search model specified
- **WHEN** `GEMINI_MODEL` environment variable is set
- **THEN** the server uses the specified model for main search tasks
- **AND** passes `--model <value>` to the Gemini CLI for search spawns

#### Scenario: Correction model specified
- **WHEN** `GEMINI_CORRECTION_MODEL` environment variable is set
- **THEN** the server uses the specified model for JSON correction tasks
- **AND** passes `--model <value>` to the Gemini CLI for correction spawns

#### Scenario: Both models specified
- **WHEN** both `GEMINI_MODEL` and `GEMINI_CORRECTION_MODEL` are set
- **THEN** the server uses each specified model for its respective task
- **AND** each task uses its independently configured model

### Requirement: JSON Retry Logic with Correction Fallback

The `search` tool SHALL implement a two-stage retry strategy for JSON parsing failures: first attempt correction on the invalid output, then retry the entire cycle if correction also fails.

#### Scenario: Initial attempt - main search prompt
- **WHEN** a search begins
- **THEN** the server runs the main research prompt via Gemini CLI
- **AND** attempts to extract and validate JSON from the output

#### Scenario: JSON parsing failure - correction attempt
- **WHEN** the main search returns output that cannot be parsed as valid JSON
- **THEN** the server immediately attempts JSON correction
- **AND** writes the invalid output to a temporary file (`temp-invalid-output-{unix-timestamp}.txt`) in the config directory
- **AND** spawns a new Gemini CLI with a correction prompt
- **AND** the correction prompt includes:
  - The expected JSON schema as a full JSON example (success, report, metadata fields)
  - The path to the temporary file containing the invalid output
  - Instructions to read from that file, extract research information, and format properly
- **AND** logs a distinct "JSON correction failed" error if correction fails

#### Scenario: Temporary file cleanup
- **WHEN** the correction attempt completes (success or failure)
- **THEN** the server deletes the temporary file
- **AND** logs an error if cleanup fails

#### Scenario: Correction success
- **WHEN** the correction step successfully produces valid JSON
- **THEN** the server accepts the corrected result
- **AND** returns the search result (no additional retries needed)

#### Scenario: Correction failure - retry cycle
- **WHEN** the correction step also fails to produce valid JSON
- **THEN** the server retries the entire cycle (main search → correction if needed)
- **AND** waits with exponential backoff: 1s, 2s, then 5s
- **AND** after 3 total cycles, throws an error if all failed

#### Scenario: All attempts exhausted
- **WHEN** all retry cycles (main search + correction) fail
- **THEN** the server returns an error with code `EXECUTION_ERROR`
- **AND** the error message indicates all retry and correction attempts were exhausted

### Requirement: Metadata Model Field Detection

The `search` tool SHALL populate the `metadata.model` field with the actual model used, whether explicitly configured or auto-selected.

#### Scenario: Model explicitly configured
- **WHEN** `GEMINI_MODEL` environment variable is set
- **THEN** the server stores the configured model name in `metadata.model`

#### Scenario: Model auto-selected with successful detection
- **WHEN** `GEMINI_MODEL` is not set and model detection from CLI output succeeds
- **THEN** the server stores the detected model name in `metadata.model`

#### Scenario: Model auto-selected with failed detection
- **WHEN** `GEMINI_MODEL` is not set and model detection from CLI output fails
- **THEN** the server stores the placeholder value `"auto-detected"` in `metadata.model`
