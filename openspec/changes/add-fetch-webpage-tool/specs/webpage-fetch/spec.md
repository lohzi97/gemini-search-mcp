## ADDED Requirements

### Requirement: Webpage Fetching

The MCP server SHALL provide a `fetch_webpage` tool that accepts a URL and returns the content in clean markdown format.

#### Scenario: Successful webpage fetch and conversion
- **WHEN** a valid URL is provided to fetch_webpage
- **THEN** the tool SHALL return clean markdown content with metadata including duration, timestamp, model, and cleanup status

#### Scenario: HTML fetch failure
- **WHEN** Gemini CLI fails to fetch the HTML content
- **THEN** the tool SHALL return an error response with failure details and no fallback content

#### Scenario: HTML to Markdown conversion failure
- **WHEN** Turndown fails to convert HTML to markdown
- **THEN** the tool SHALL return the raw HTML content with error notes indicating the conversion failed

#### Scenario: AI cleanup failure
- **WHEN** Gemini CLI fails to clean the markdown
- **THEN** the tool SHALL return the Turndown-converted markdown with error notes indicating AI cleanup failed

#### Scenario: JavaScript-rendered content
- **WHEN** the URL contains JavaScript-rendered content
- **THEN** Gemini CLI SHALL use browser MCP or similar tools to fetch the fully rendered HTML

#### Scenario: Cloudflare-protected pages
- **WHEN** the URL is protected by Cloudflare anti-bot measures
- **THEN** Gemini CLI SHALL use browser MCP to bypass protection and fetch the HTML

### Requirement: Markdown Cleanup Optimization

The tool SHALL use Gemini CLI to clean and optimize the markdown output from Turndown conversion.

#### Scenario: Cleanup removes navigation and scripts
- **WHEN** raw HTML contains navigation menus, scripts, and styles
- **THEN** the AI cleanup SHALL remove all such elements from the markdown

#### Scenario: Cleanup fixes code blocks
- **WHEN** the markdown contains code snippets
- **THEN** the AI cleanup SHALL add appropriate language identifiers to code blocks

#### Scenario: Cleanup converts tables
- **WHEN** the HTML contains table structures
- **THEN** the AI cleanup SHALL convert them to properly formatted Markdown tables

#### Scenario: Cleanup handles UI components
- **WHEN** the HTML contains tabs, accordions, or other UI components
- **THEN** the AI cleanup SHALL expose hidden content as plain text or headers

### Requirement: Return Structure

The fetch_webpage tool SHALL return responses in the same structure pattern as existing search tools.

#### Scenario: Success response
- **WHEN** all steps complete successfully
- **THEN** the response SHALL include: success (true), content (markdown string), url (original URL), format ("markdown"), and metadata object

#### Scenario: Metadata content
- **WHEN** a successful response is returned
- **THEN** the metadata SHALL include: duration_ms (number), timestamp (ISO string), model (string), and cleanup_status (enum: "full", "turndown_only", "html_only")

#### Scenario: Error response structure
- **WHEN** an error occurs
- **THEN** the response SHALL include: success (false), error object with code, message, and optional details, and optionally fallback_html if available
