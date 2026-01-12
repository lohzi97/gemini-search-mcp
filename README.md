# Gemini Search MCP

A Model Context Protocol (MCP) server that wraps the Google Gemini CLI with Firecrawl integration for web search capabilities.

## Overview

**Gemini Search MCP** is an npm package that exposes two search tools to MCP-compliant clients (Claude Desktop, Cursor, etc.). Unlike standard search tools that return shallow snippets, this server acts as a **Sub-Agent Orchestrator** that:

1. Spawns an autonomous Gemini CLI instance
2. Executes live Google Searches via Grounding
3. Scrapes web pages with JavaScript rendering via Firecrawl MCP
4. Produces a comprehensive research report

### Key Features

- **Two Research Modes**: `search` (quick single-round) and `deep_search` (multi-round with verification)
- **JavaScript Rendering**: Firecrawl handles JS-heavy sites and returns clean Markdown
- **Graceful Degradation**: Falls back to Google Search if Firecrawl is unavailable
- **Dual Transport**: Supports both stdio (Claude Desktop) and HTTP (remote clients)
- **Configurable**: Environment variables for model selection, timeouts, and more

## Architecture

```
User / IDE → Main AI → gemini-search-mcp → Gemini CLI → {Google Search, Firecrawl}
```

The package creates a dedicated configuration directory with project-level Gemini CLI settings that pre-configure Firecrawl MCP. When Gemini CLI runs from this directory, it automatically has access to Firecrawl tools.

## Prerequisites

1. **Node.js 22+ LTS** - Required for npm package installation
2. **Gemini CLI** - Install via `npm install -g @google/gemini-cli`
3. **Gemini CLI Authentication** - Run `gemini auth login` or set `GEMINI_API_KEY`
4. **Firecrawl Access (Optional)** - Get a free API key from [Firecrawl.dev](https://www.firecrawl.dev)
5. **MCP Client** - Claude Desktop, Cursor, or any MCP-compliant client

## Installation

```bash
# Install globally via npm
npm install -g @lohzi97/gemini-search-mcp

# First time setup: Install and authenticate Gemini CLI
npm install -g @google/gemini-cli
gemini auth login  # Opens browser for OAuth

# (Optional) Set Firecrawl API key for JavaScript rendering
export FIRECRAWL_API_KEY=your_firecrawl_api_key
```

## Usage

### Starting the Server

**Stdio mode (for Claude Desktop):**
```bash
gemini-search-mcp
```

**HTTP mode (for remote clients):**
```bash
MCP_SERVER_PORT=3000 gemini-search-mcp-http
```

### Claude Desktop Configuration

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "gemini-search-mcp",
      "args": [],
      "env": {
        "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}",
        "GEMINI_MODEL": "gemini-2.5-flash"
      }
    }
  }
}
```

### Claude Code (CLI) Configuration

**Method 1: CLI Command**

```bash
claude mcp add --transport stdio gemini-search \
  --env FIRECRAWL_API_KEY=fc-your-api-key-here \
  --env GEMINI_MODEL=gemini-2.5-flash \
  -- gemini-search-mcp
```

**Method 2: Manual Configuration**

Add to your config at **`~/.claude.json`** (recommended) or **`~/.claude/mcp_servers.json`**:

```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "gemini-search-mcp",
      "env": {
        "FIRECRAWL_API_KEY": "fc-your-api-key-here",
        "GEMINI_MODEL": "gemini-2.5-flash"
      }
    }
  }
}
```

**Note:** Some documentation incorrectly mentions `~/.config/claude-code/mcp_servers.json` - this location is not recognized by Claude Code.

**To verify:** In Claude Code, ask "List available MCP tools" to confirm `search` and `deep_search` appear.

### Using the Tools

This MCP server provides two research tools for different use cases:

#### 1. `search` - Quick Single-Round Search

Best for simple queries that don't require multiple iterations.

**Parameters:**
- `query` (string, required): The search query or question

**Example:**
```
Please search for the current population of Tokyo.
Use the search tool.
```

#### 2. `deep_search` - Multi-Round Iterative Search with Verification

Best for complex topics requiring thorough verification and server-orchestrated iterations.

**Parameters:**
- `topic` (string, required): The research question or topic
- `maxIterations` (number, optional): Maximum verification rounds (default: 5, max: 10)

**Example:**
```
Please research the impact of AI on healthcare in 2024.
Use the deep_search tool with maxIterations of 5.
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model to use |
| `FIRECRAWL_API_KEY` | *none* | Firecrawl API key for cloud API |
| `FIRECRAWL_API_URL` | *none* | URL for self-hosted Firecrawl |
| `GEMINI_SEARCH_TIMEOUT` | `300000` | Max wait time in milliseconds |
| `GEMINI_SYSTEM_PROMPT` | *built-in* | Custom system prompt template |
| `DEEP_SEARCH_MAX_ITERATIONS` | `5` | Max verification rounds for deep_search |
| `MCP_SERVER_PORT` | `3000` | HTTP server port |
| `DEBUG` | `false` | Enable verbose logging |

See `.env.example` for all available options.

### Configuration Directory

The package creates `~/.config/gemini-search-mcp/` (Linux) or platform-appropriate equivalent containing:

```
~/.config/gemini-search-mcp/
└── .gemini/
    └── settings.json  # Generated from template, contains Firecrawl MCP config
```

## How It Works

1. User calls `search` or `deep_search` tool from their AI client
2. gemini-search-mcp receives the request and spawns Gemini CLI
3. Gemini CLI runs from config directory with Firecrawl MCP pre-configured
4. Gemini CLI uses Google Search and Firecrawl to research the topic
5. Results are returned as structured JSON to the main AI

## Troubleshooting

### Gemini CLI Not Found
```
Error: gemini command not found
```
**Solution:** Install Gemini CLI via `npm install -g @google/gemini-cli`

### Firecrawl Unavailable
If Firecrawl fails to connect, the system gracefully degrades to Google Search only. Check:
- `FIRECRAWL_API_KEY` is set correctly
- Your Firecrawl account has available credits

### Timeout Errors
Increase `GEMINI_SEARCH_TIMEOUT` for complex queries:
```bash
export GEMINI_SEARCH_TIMEOUT=600000  # 10 minutes
```

### Debug Mode
Enable verbose logging:
```bash
DEBUG=true gemini-search-mcp
```

## Development

```bash
# Clone repository
git clone https://github.com/your-username/gemini-search-mcp.git
cd gemini-search-mcp

# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Link for testing
npm link
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to the main repository.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Google Gemini CLI](https://github.com/google/gemini-cli) - The underlying CLI tool
- [Firecrawl](https://www.firecrawl.dev) - Web scraping with JavaScript rendering
- [Model Context Protocol](https://modelcontextprotocol.io) - The protocol specification

## Links

- [Product Requirements Document](prd.md)
- [Phase 0 Verification Results](PHASE_0_RESULTS.md)
- [Issue Tracker](https://github.com/your-username/gemini-search-mcp/issues)
