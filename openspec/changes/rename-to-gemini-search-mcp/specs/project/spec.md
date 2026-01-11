## MODIFIED Requirements

### Requirement: Project Purpose

The project SHALL be named "Gemini Search MCP" and SHALL provide web search capabilities by orchestrating the Google Gemini CLI as a sub-agent. The package name MUST be `gemini-search-mcp` to accurately reflect that the server provides search tools (`search`, `deep_search`) rather than generic research capabilities.

The key architectural pattern is a "Russian Doll" agent nesting:
```
User/IDE → Main AI (Claude/Cursor) → gemini-search-mcp → Gemini CLI → {Google Search, Firecrawl MCP}
```

#### Scenario: Package name consistency
- **WHEN** a consuming agent searches for an MCP server providing web search
- **THEN** the package name `gemini-search-mcp` clearly indicates search capabilities
- **AND** the tool names (`search`, `deep_search`) align with the package name

### Requirement: Config Isolation Pattern

The MCP server SHALL create its own Gemini CLI config directory at platform-specific paths to avoid conflicts with the user's personal Gemini settings. The config directory path MUST use the package name `gemini-search-mcp`:
- Linux: `~/.config/gemini-search-mcp/.gemini/`
- macOS: `~/Library/Application Support/gemini-search-mcp/.gemini/`
- Windows: `%APPDATA%\gemini-search-mcp\.gemini\`

#### Scenario: Config directory isolation
- **WHEN** the MCP server initializes
- **THEN** it creates/uses a config directory specific to `gemini-search-mcp`
- **AND** this config is isolated from the user's personal Gemini CLI settings

### Requirement: Environment Variable Naming

All project-specific environment variables SHALL use the `GEMINI_SEARCH_` prefix to match the package name. The variable names MUST be updated from the previous `GEMINI_RESEARCH_` prefix.

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_SEARCH_TIMEOUT` | `300000` | Max search duration in ms |
| `GEMINI_SEARCH_CONFIG_DIR` | (auto) | Override config directory path |

#### Scenario: Environment variable consistency
- **WHEN** a user configures the MCP server via environment variables
- **THEN** all project-specific variables use the `GEMINI_SEARCH_` prefix
- **AND** the prefix matches the package name for clarity

### Requirement: Binary Naming

The package MUST provide two binary executables with names matching the package name:
- `gemini-search-mcp` - Stdio mode (default transport)
- `gemini-search-mcp-http` - HTTP mode (optional transport)

#### Scenario: Binary command invocation
- **WHEN** an MCP client configuration references the binary
- **THEN** the command name `gemini-search-mcp` matches the package name
- **AND** users can intuitively guess the binary name from the package name
