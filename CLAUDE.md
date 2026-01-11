# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gemini Research MCP** is a Model Context Protocol server that orchestrates the Google Gemini CLI as a sub-agent for deep web research. The key architectural pattern is a "Russian Doll" agent nesting:

```
User/IDE → Main AI (Claude/Cursor) → gemini-research-mcp → Gemini CLI → {Google Search, Firecrawl MCP}
```

The MCP server spawns a Gemini CLI instance with pre-configured Firecrawl MCP tools, enabling comprehensive research with JavaScript rendering. It gracefully degrades if Firecrawl is unavailable.

## Development Commands

```bash
# Build the project (outputs to dist/)
npm run build

# Development mode (stdio transport, uses tsx for hot-reload)
npm run dev

# Manual test of deep_research tool (requires GEMINI_MODEL env var)
node test-research.ts

# Build before publishing (automatic)
npm run prepublishOnly
```

## Architecture

### Entry Points

- **`src/index.ts`** - Stdio mode entry point → `gemini-research-mcp` binary
- **`src/http.ts`** - HTTP mode entry point → `gemini-research-mcp-http` binary

Both call `ensureConfigSetup()` before creating the MCP server.

### Core Modules

- **`src/server.ts`** - Creates MCP server, registers `deep_research` tool with Zod schema
- **`src/deep-research.ts`** - Orchestrates Gemini CLI spawn, output parsing, retries
- **`src/config.ts`** - Environment variable handling and logging utilities
- **`src/config-setup.ts`** - Config directory creation and settings.json generation from template

### Config Isolation Pattern

The project creates a project-level Gemini CLI configuration at platform-specific paths:
- Linux: `~/.config/gemini-research-mcp/.gemini/settings.json`
- macOS: `~/Library/Application Support/gemini-research-mcp/.gemini/settings.json`
- Windows: `%APPDATA%\gemini-research-mcp\.gemini\settings.json`

This config pre-configures Firecrawl MCP as an available tool. When spawning Gemini CLI, we set `cwd` to this config directory so the CLI picks up the MCP tools.

### Key Patterns

1. **Stdin Piping for Prompts**: Research prompts are piped via stdin (not `--prompt` flag) due to length limits
2. **Multi-Strategy JSON Extraction**: Tries fenced code blocks first, then raw object patterns
3. **Retry with Exponential Backoff**: Up to 3 retries for JSON parsing failures (1s, 2s, 5s max)
4. **Double-Kill Cleanup**: SIGTERM → 5 second wait → SIGKILL for process termination
5. **Template-Based Config**: `templates/gemini-settings.json.template` uses `{{VAR}}` placeholders substituted at generation time

### Environment Variables

See `.env.example` for full list. Key variables:
- `GEMINI_MODEL` - Model to use (default: `gemini-2.5-flash`)
- `GEMINI_RESEARCH_TIMEOUT` - Max research duration in ms (default: 300000)
- `FIRECRAWL_API_KEY` / `FIRECRAWL_API_URL` - Firecrawl configuration
- `DEBUG` - Enable verbose logging to stderr
- `MCP_SERVER_PORT` - HTTP server port (default: 3000)

## Error Handling

All errors return structured JSON with `code`, `message`, `details` fields. Logging goes to stderr to keep stdout clean for MCP protocol messages:
- `[DEBUG]` - Verbose output (only when DEBUG=true)
- `[INFO]` - Progress updates
- `[WARN]` - Warnings
- `[ERROR]` - Errors

## OpenSpec Workflow

This project uses OpenSpec for spec-driven development. Always open `@/openspec/AGENTS.md` when:
- Making proposals or planning changes
- Introducing new capabilities or breaking changes
- You need authoritative specifications before coding

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
