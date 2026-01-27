# Project Context

## Purpose

**Gemini Search MCP** is a Model Context Protocol (MCP) server that provides web search capabilities by orchestrating the Google Gemini CLI as a sub-agent. The project enables AI assistants (like Claude, Cursor) to conduct comprehensive research using Google Search and web content analysis, with optional support for JavaScript-rendered sites via Firecrawl.

The key architectural pattern is a "Russian Doll" agent nesting:
```
User/IDE → Main AI (Claude/Cursor) → gemini-search-mcp → Gemini CLI → Google Search + Web Tools
```

### Goals

1. **Seamless Search Integration**: Provide `search` and `deep_search` tools that AI assistants can call for web search
2. **Flexible Web Access**: Work with Gemini's built-in web tools, with optional Firecrawl for JS-heavy sites
3. **Config Isolation**: Create project-level Gemini CLI configuration to avoid conflicting with user's personal Gemini settings
4. **Structured Output**: Return search results as typed JSON with metadata for easy parsing

## Tech Stack

### Core Technologies

- **TypeScript 5.6+** - Primary language with strict type checking
- **Node.js 22+** - Runtime environment (ES modules only)
- **Model Context Protocol SDK** (`@modelcontextprotocol/sdk` ^1.25.2) - MCP server implementation
- **Zod 4.0+** - Runtime type validation and schema definition
- **Express 4.18+** - HTTP server for HTTP transport mode (optional)

### Development Tools

- **tsup 8+** - Bundling/build tool (outputs ESM to `dist/`)
- **tsx 4+** - Development execution with hot-reload
- **dotenv 16+** - Environment variable loading

### External CLI Dependencies

- **Google Gemini CLI** (`@google/gemini-cli`) - Must be installed globally, spawned as child process

## Project Conventions

### Code Style

1. **Module System**: ES modules only (`"type": "module"` in package.json)
2. **Imports**: Use `.js` extensions for all imports (TypeScript compiles to .js)
3. **Comments**: JSDoc-style comments for all exported functions and interfaces
4. **Naming**:
   - Functions: `camelCase` with descriptive verbs (`executeResearchWithRetry`, `buildPrompt`)
   - Interfaces/Types: `PascalCase` with semantic suffixes (`ResearchParams`, `ResearchResult`, `ResearchSuccess`)
   - Constants: `SCREAMING_SNAKE_CASE` or `camelCase` for config objects
   - Files: `kebab-case` (`deep-research.ts`, `config-setup.ts`)
5. **Error Handling**:
   - Always return structured errors with `code`, `message`, and optional `details` fields
   - Use typed discriminated unions for success/failure results (`ResearchSuccess | ResearchError`)
6. **Logging**:
   - All logs go to `stderr` (stdout reserved for MCP protocol)
   - Prefix with level: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`
   - Use `debugLog()` for verbose output (only when `DEBUG=true`)

### Architecture Patterns

1. **Config Isolation Pattern**: Project creates its own Gemini CLI config directory at platform-specific paths to avoid conflicts:
   - Linux: `~/.config/gemini-search-mcp/.gemini/`
   - macOS: `~/Library/Application Support/gemini-search-mcp/.gemini/`
   - Windows: `%APPDATA%\gemini-search-mcp\.gemini\`

2. **Stdin Piping for Prompts**: Search prompts are piped via stdin (not `--prompt` flag) due to CLI argument length limits

3. **Multi-Strategy JSON Extraction**: Tries fenced code blocks first (```` ```json ... ``` ````), then raw object patterns for extracting research results

4. **Retry with Exponential Backoff**: Up to 3 retries for JSON parsing failures (1s, 2s, 5s max delays) and markdown cleanup failures

5. **Double-Kill Process Cleanup**: SIGTERM → 5 second wait → SIGKILL for process termination

6. **Template-Based Config**: `templates/gemini-settings.json.template` uses `{{VAR}}` placeholders substituted at config generation time

### File Structure

```
src/
├── index.ts          # Stdio mode entry point
├── http.ts           # HTTP mode entry point
├── server.ts         # MCP server creation, tool registration
├── search.ts         # Single-round search orchestration
├── deep-search.ts    # Multi-round iterative search orchestration, Gemini CLI spawn
├── config.ts         # Environment variables, logging utilities
└── config-setup.ts   # Config directory creation, settings.json generation

templates/
└── gemini-settings.json.template  # Template for Gemini CLI config

prompts/
└── search-prompt.md  # System prompt template for search tasks

dist/                 # Built output (not in source control)
```

### Testing Strategy

Currently uses manual testing via `node test-research.ts`. No automated test suite is implemented yet.

### Git Workflow

- **Main branch**: `master`
- **Commit style**: Conventional commits preferred (e.g., "Refactor config setup", "initial implementation")
- **Pre-publish**: `npm run prepublishOnly` automatically builds before publishing

## Domain Context

### Model Context Protocol (MCP)

MCP is a protocol for connecting AI assistants to external tools and data sources. This project implements an MCP **server** that exposes `search` and `deep_search` tools.

### Transport Modes

1. **Stdio (default)**: Communicates via stdin/stdout, used by most MCP clients
2. **HTTP (optional)**: Runs an Express server on port 3000, useful for remote connections

### Search Flow

#### Search and Deep Search
1. Client calls `search` with `{ query: string }` or `deep_search` with `{ topic: string, maxIterations?: number }`
2. Server validates Gemini CLI is available
3. Server builds search prompt from template with placeholders
4. Server spawns Gemini CLI with config directory containing Firecrawl MCP tools
5. Gemini CLI performs search using available tools (search, scrape, etc.)
6. Server parses JSON output from CLI (with retry logic)
7. Server returns structured result with metadata

## Important Constraints

1. **Node.js 22+ Required**: Project uses modern ES features and requires Node 22 or higher
2. **Gemini CLI Required**: The external `@google/gemini-cli` package must be installed globally
3. **Timeout Default**: Research tasks timeout after 5 minutes (300000ms) by default
4. **Stdio for MCP Protocol**: All MCP protocol messages must go to stdout; logs go to stderr
5. **ESM Only**: No CommonJS support; all imports must use `.js` extensions

## External Dependencies

### Required

- **Google Gemini CLI**: `npm install -g @google/gemini-cli`
  - Spawned as child process with `--model` flag
  - Must support `--version` check for availability detection

### Optional

- **Firecrawl**: For enhanced JavaScript-rendered web scraping
  - API key from https://www.firecrawl.dev
  - If unavailable, Gemini CLI uses its built-in web tools
  - Configured via `FIRECRAWL_API_KEY` and `FIRECRAWL_API_URL` env vars

### Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model to use for search |
| `GEMINI_SEARCH_TIMEOUT` | `300000` | Max search duration in ms |
| `FIRECRAWL_API_KEY` | (empty) | Firecrawl API key |
| `DEBUG` | `false` | Enable verbose logging |
| `MCP_SERVER_PORT` | `3000` | HTTP server port |
