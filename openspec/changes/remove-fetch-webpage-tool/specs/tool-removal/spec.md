## REMOVED Requirements

### Requirement: Webpage Fetching
**Reason**: The fetch_webpage tool is being removed due to fundamental issues with Gemini CLI's HTML fetching reliability (output truncation, no continuation support, and complexity vs benefit). The project's focus is on web search capabilities, and webpage reading should be handled by specialized MCPs.

#### Scenario: Remove fetch implementation file
- **WHEN** the project is being modified to remove fetch_webpage
- **THEN** `src/fetch.ts` file SHALL be completely deleted
- **AND** all imports from `src/fetch.ts` SHALL be removed from other files

#### Scenario: Remove prompt template files
- **WHEN** the project is being modified to remove fetch_webpage
- **THEN** `prompts/fetch-html-prompt.md` file SHALL be completely deleted
- **AND** `prompts/fetch-cleanup-prompt.md` file SHALL be completely deleted

### Requirement: Turndown Dependency
**Reason**: The Turndown library is only used by the fetch_webpage tool for HTML to Markdown conversion and is no longer needed.

#### Scenario: Remove Turndown dependency
- **WHEN** fetch_webpage is being removed
- **THEN** `turndown` package SHALL be removed from package.json dependencies
- **AND** `@types/turndown` package SHALL be removed from package.json devDependencies

### Requirement: Fetch Webpage Tool Registration
**Reason**: The fetch_webpage tool is being removed from the MCP server, so its registration in server.ts must be removed.

#### Scenario: Remove fetch_webpage tool registration
- **WHEN** the MCP server is created in src/server.ts
- **THEN** the `fetch_webpage` tool SHALL NOT be registered
- **AND** only `search` and `deep_search` tools SHALL be registered
- **AND** imports for `fetchWebpage` and `FetchParams` SHALL be removed

### Requirement: Chrome DevTools MCP Integration
**Reason**: Chrome DevTools MCP is only needed for fetch_webpage functionality and is no longer required. Removing it from allowed MCP servers improves Gemini CLI startup time.

#### Scenario: Remove chrome-devtools from Gemini CLI arguments
- **WHEN** the Gemini CLI is spawned in src/utils.ts
- **THEN** the `--allowed-mcp-server-names` argument with `chrome-devtools` SHALL be removed
- **AND** the CLI arguments SHALL only include necessary options for search functionality

#### Scenario: Remove chrome-devtools from MCP configuration
- **WHEN** the Gemini CLI settings template is generated or updated in src/config-setup.ts
- **THEN** `chrome-devtools` SHALL be removed from the `mcpServers` object
- **AND** the configuration SHALL only contain MCP servers needed for search functionality (e.g., firecrawl if configured)

#### Scenario: Remove chrome-devtools from settings template
- **WHEN** the gemini-settings.json.template file is modified
- **THEN** the entire `chrome-devtools` MCP server configuration block SHALL be removed
- **AND** the Firecrawl configuration SHALL remain unchanged

### Requirement: Documentation for Fetch Webpage
**Reason**: Documentation references to fetch_webpage must be removed to reflect the tool's removal from the project.

#### Scenario: Update README.md
- **WHEN** README.md is modified
- **THEN** all references to fetch_webpage SHALL be removed
- **AND** the project SHALL be described as providing "Two Research Modes" instead of three
- **AND** the tools section SHALL only document `search` and `deep_search`

#### Scenario: Update project.md
- **WHEN** openspec/project.md is modified
- **THEN** all references to fetch_webpage SHALL be removed
- **AND** file structure SHALL NOT include fetch.ts
- **AND** file structure SHALL NOT include fetch-html-prompt.md or fetch-cleanup-prompt.md
- **AND** the tool list SHALL only include `search` and `deep_search`
- **AND** the "Webpage Fetch" flow section SHALL be removed

#### Scenario: Update AGENTS.md
- **WHEN** AGENTS.md is modified
- **THEN** fetch.ts SHALL be removed from the file organization section

#### Scenario: Update .env.example
- **WHEN** .env.example is modified
- **THEN** the SECONDARY_GEMINI_MODEL comment SHALL NOT reference webpage fetching
- **AND** the comment SHALL only mention JSON correction in search/deep_search

### Requirement: Version Bump for Breaking Change
**Reason**: Removing a public tool (fetch_webpage) is a breaking change that requires a major version bump according to Semantic Versioning.

#### Scenario: Bump version for breaking change
- **WHEN** the fetch_webpage tool is being removed
- **THEN** the version in package.json SHALL be bumped to `0.2.0`
- **AND** the version bump SHALL reflect a major version change (breaking change)
- **AND** the hardcoded version in src/server.ts SHALL be synchronized to `0.2.0`

### Requirement: JSDoc Update for API Clarity
**Reason**: The createServer() function JSDoc comment should accurately reflect the tools being registered.

#### Scenario: Update JSDoc comment for createServer
- **WHEN** the fetch_webpage tool registration is removed from src/server.ts
- **THEN** the JSDoc comment for the `createServer()` function SHALL be updated
- **AND** the comment SHALL reflect that only 2 tools (`search` and `deep_search`) are registered

### Requirement: Firecrawl MCP Validation
**Reason**: Firecrawl MCP is still needed for search/deep_search tools to handle JavaScript-rendered sites. It must continue to work correctly after fetch_webpage removal.

#### Scenario: Verify Firecrawl MCP functionality
- **WHEN** the validation step is executed after removal
- **THEN** Firecrawl MCP configuration SHALL remain intact in templates/gemini-settings.json.template
- **AND** Firecrawl MCP configuration SHALL be correctly generated in src/config-setup.ts
- **AND** Firecrawl MCP SHALL continue to work with search and deep_search tools
- **AND** verification SHALL confirm that Firecrawl integration is not affected
