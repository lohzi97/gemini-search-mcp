# Project Context

## Purpose

**Gemini Research MCP** is a Model Context Protocol (MCP) server that provides deep web research capabilities by orchestrating the Google Gemini CLI as a sub-agent. The project enables AI assistants (like Claude, Cursor) to conduct comprehensive research with JavaScript-rendered web content through Firecrawl integration.

The key architectural pattern is a "Russian Doll" agent nesting:
```
User/IDE → Main AI (Claude/Cursor) → gemini-research-mcp → Gemini CLI → {Google Search, Firecrawl MCP}
```

### Goals

1. **Seamless Research Integration**: Provide a single `deep_research` tool that AI assistants can call for comprehensive web research
2. **Graceful Degradation**: Function with or without Firecrawl MCP (falls back to Gemini's built-in `web_fetch`)
3. **Config Isolation**: Create project-level Gemini CLI configuration to avoid conflicting with user's personal Gemini settings
4. **Structured Output**: Return research results as typed JSON with metadata for easy parsing

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
   - Linux: `~/.config/gemini-research-mcp/.gemini/`
   - macOS: `~/Library/Application Support/gemini-research-mcp/.gemini/`
   - Windows: `%APPDATA%\gemini-research-mcp\.gemini\`

2. **Stdin Piping for Prompts**: Research prompts are piped via stdin (not `--prompt` flag) due to CLI argument length limits

3. **Multi-Strategy JSON Extraction**: Tries fenced code blocks first (```` ```json ... ``` ````), then raw object patterns for extracting research results

4. **Retry with Exponential Backoff**: Up to 3 retries for JSON parsing failures (1s, 2s, 5s max delays)

5. **Double-Kill Process Cleanup**: SIGTERM → 5 second wait → SIGKILL for process termination

6. **Template-Based Config**: `templates/gemini-settings.json.template` uses `{{VAR}}` placeholders substituted at config generation time

### File Structure

```
src/
├── index.ts          # Stdio mode entry point
├── http.ts           # HTTP mode entry point
├── server.ts         # MCP server creation, tool registration
├── deep-research.ts  # Core research orchestration, Gemini CLI spawn
├── config.ts         # Environment variables, logging utilities
└── config-setup.ts   # Config directory creation, settings.json generation

templates/
└── gemini-settings.json.template  # Template for Gemini CLI config

prompts/
└── research-prompt.md  # System prompt template for research tasks

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

MCP is a protocol for connecting AI assistants to external tools and data sources. This project implements an MCP **server** that exposes a single `deep_research` tool.

### Transport Modes

1. **Stdio (default)**: Communicates via stdin/stdout, used by most MCP clients
2. **HTTP (optional)**: Runs an Express server on port 3000, useful for remote connections

### Research Flow

1. Client calls `deep_research` with `{ topic: string, depth: 'concise' | 'detailed' }`
2. Server validates Gemini CLI is available
3. Server builds research prompt from template with placeholders
4. Server spawns Gemini CLI with config directory containing Firecrawl MCP tools
5. Gemini CLI performs research using available tools (search, scrape, etc.)
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

- **Firecrawl MCP**: For JavaScript-rendered web scraping
  - API key from https://www.firecrawl.dev
  - If unavailable, Gemini CLI falls back to built-in `web_fetch`
  - Configured via `FIRECRAWL_API_KEY` and `FIRECRAWL_API_URL` env vars

### Environment Variables

See `.env.example` for complete list. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model to use for research |
| `GEMINI_RESEARCH_TIMEOUT` | `300000` | Max research duration in ms |
| `FIRECRAWL_API_KEY` | (empty) | Firecrawl API key |
| `DEBUG` | `false` | Enable verbose logging |
| `MCP_SERVER_PORT` | `3000` | HTTP server port |
