# Search Capability

## ADDED Requirements

### Requirement: Single-Round Search Tool

The MCP server SHALL provide a `search` tool that performs exactly one round of Google Search followed by content fetching from promising results.

#### Scenario: Successful single-round search
- **WHEN** a user calls `search` with a query string
- **THEN** the server spawns Gemini CLI with a single-round search prompt
- **AND** Gemini CLI performs one Google Search for the query
- **AND** Gemini CLI fetches full content from 3-5 most promising URLs
- **AND** the server returns a JSON response with success, result summary, and metadata

#### Scenario: Gemini CLI not available
- **WHEN** `search` is called but Gemini CLI is not installed
- **THEN** the server returns an error with code `CLI_NOT_FOUND`
- **AND** the error includes installation instructions

#### Scenario: Search timeout
- **WHEN** the search exceeds the configured timeout (default: 300000ms)
- **THEN** the server terminates the Gemini CLI process
- **AND** returns an error with code `EXECUTION_ERROR`

### Requirement: Search Result Format

The `search` tool SHALL return results in a consistent JSON format.

#### Scenario: Successful response format
- **WHEN** search completes successfully
- **THEN** the response includes:
  - `success: true`
  - `result: string` - Markdown formatted summary with citations
  - `metadata: object` containing:
    - `duration_ms: number`
    - `query: string`
    - `model: string`
    - `timestamp: string`
    - `sources_visited: string[]` (optional)

#### Scenario: Error response format
- **WHEN** search fails
- **THEN** the response includes:
  - `success: false`
  - `error: object` containing:
    - `code: string`
    - `message: string`
    - `details: string` (optional)

### Requirement: Search Prompt Template

The `search` tool SHALL use a dedicated prompt template that instructs Gemini CLI to perform exactly one search round.

#### Scenario: Template loading
- **WHEN** building the search prompt
- **THEN** the server loads `prompts/search-prompt.md`
- **AND** substitutes `{{query}}` with the user's query
- **AND** falls back to a built-in prompt if template is missing

#### Scenario: Template content
- **WHEN** the prompt is sent to Gemini CLI
- **THEN** the prompt instructs Gemini to:
  - Use `google_web_search` exactly once
  - Fetch content from 3-5 most promising URLs
  - Return a concise summary with source citations
  - NOT perform additional searches or iterations

### Requirement: JSON Retry Logic

The `search` tool SHALL retry on JSON parsing failures with exponential backoff.

#### Scenario: JSON parsing failure
- **WHEN** Gemini CLI returns output that cannot be parsed as valid JSON
- **THEN** the server retries up to 3 times
- **AND** waits 1 second, 2 seconds, then 5 seconds between retries
- **AND** returns an error if all retries fail
