# Deep Search Capability

## ADDED Requirements

### Requirement: Multi-Round Deep Search Tool

The MCP server SHALL provide a `deep_search` tool that performs iterative research with server-side verification loops.

#### Scenario: Successful multi-round deep search
- **WHEN** a user calls `deep_search` with a query string
- **THEN** the server initiates Round 1 by spawning Gemini CLI with the deep search prompt
- **AND** Gemini CLI performs 5-perspective search and returns a temporary result
- **AND** for subsequent rounds (2-5), the server:
  - Feeds the original query + current temporary result to Gemini CLI
  - Uses a verification prompt requesting validation and updates
  - Gemini CLI performs verification searches from multiple perspectives
  - Updates the temporary result
- **AND** the loop continues until:
  - Maximum iterations (default: 5) is reached, OR
  - Gemini CLI returns `verified: true`
- **AND** the server returns the final result with full metadata

#### Scenario: Early termination on verification
- **WHEN** Gemini CLI returns `verified: true` before max iterations
- **THEN** the server immediately returns the current result
- **AND** includes metadata showing actual iteration count

#### Scenario: Maximum iterations reached
- **WHEN** the loop reaches maximum iterations without verification
- **THEN** the server returns the best result obtained
- **AND** includes a note that verification was not completed

### Requirement: Deep Search Result Format

The `deep_search` tool SHALL return results in a consistent JSON format with per-round metadata.

#### Scenario: Successful response format
- **WHEN** deep search completes successfully
- **THEN** the response includes:
  - `success: true`
  - `result: string` - Markdown formatted final report
  - `verified: boolean` - Whether Gemini confirmed result accuracy
  - `metadata: object` containing:
    - `duration_ms: number`
    - `query: string`
    - `model: string`
    - `timestamp: string`
    - `iterations: number` - Actual rounds performed
    - `sources_visited: string[]` - All sources across all rounds
    - `search_queries_used: string[]` - All queries across all rounds
    - `rounds: array` (optional) - Per-round breakdown

#### Scenario: Per-round metadata
- **WHEN** `rounds` array is included in metadata
- **THEN** each round contains:
  - `round_number: number`
  - `sources_visited: string[]`
  - `search_queries: string[]`
  - `intermediate_result_summary: string`

### Requirement: Deep Search Prompt Templates

The `deep_search` tool SHALL use separate prompt templates for initial research and verification rounds.

#### Scenario: Initial deep search prompt
- **WHEN** Round 1 begins
- **THEN** the server loads `prompts/deep-search-prompt.md`
- **AND** substitutes `{{query}}` with the user's query
- **AND** the prompt instructs Gemini to:
  - Reconstruct the query from 5 different perspectives
  - Perform searches for each perspective
  - Fetch content from promising sites
  - Synthesize into a temporary result
  - Return with `verified: false`

#### Scenario: Verification prompt
- **WHEN** Round 2+ begins
- **THEN** the server loads `prompts/verify-prompt.md`
- **AND** provides:
  - Original query
  - Current temporary result
  - Request to verify and update
- **AND** the prompt instructs Gemini to:
  - Analyze the temporary result for accuracy
  - Perform verification searches from multiple perspectives
  - Update the result with verified information
  - Return `verified: true` if confident in accuracy

### Requirement: Progress Logging

The `deep_search` tool SHALL log progress for each round to stderr.

#### Scenario: Round progress logging
- **WHEN** each round begins
- **THEN** the server logs `[INFO] Deep search round {n}/{max}...` to stderr
- **AND** when a round completes, logs `[INFO] Round {n} completed, verified: {status}`

#### Scenario: Final result logging
- **WHEN** deep search completes
- **THEN** the server logs `[INFO] Deep search completed: {iterations} rounds, verified: {status}`

### Requirement: Configurable Iteration Limit

The `deep_search` tool SHALL support a configurable maximum iteration count via environment variable.

#### Scenario: Default iteration count
- **WHEN** no `DEEP_SEARCH_MAX_ITERATIONS` is set
- **THEN** the server defaults to 5 maximum iterations

#### Scenario: Custom iteration count
- **WHEN** `DEEP_SEARCH_MAX_ITERATIONS` is set
- **THEN** the server uses the specified value as maximum iterations

#### Scenario: Minimum iteration count
- **WHEN** `DEEP_SEARCH_MAX_ITERATIONS` is less than 2
- **THEN** the server uses a minimum of 2 iterations

### Requirement: Graceful Degradation

The `deep_search` tool SHALL handle errors during individual rounds without failing the entire search.

#### Scenario: Single round failure
- **WHEN** a verification round fails (network error, timeout, etc.)
- **THEN** the server logs the error
- **AND** continues to the next round if not at max iterations
- **OR** returns the best available result if at max iterations

#### Scenario: Gemini CLI unavailable
- **WHEN** Gemini CLI is not installed
- **THEN** the server returns an error with code `CLI_NOT_FOUND`
- **AND** the error includes installation instructions
