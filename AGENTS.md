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

# AI Coding Agent Guidelines

This file contains build commands and code style guidelines for AI agents working in this repository.

## Build Commands

```bash
# Build the project
npm run build

# Run in development mode (watch/auto-reload)
npm run dev

# Run in production mode (after build)
node dist/index.js           # stdio mode
node dist/http.js            # HTTP mode

# Test the MCP server manually
npm run dev                  # Then send MCP protocol messages via stdin
```

Note: This project does not have automated tests. Testing is done manually by running the MCP server and verifying tool behavior through MCP clients (Claude Desktop, Cursor, etc.).

## Code Style Guidelines

### TypeScript Configuration
- **Strict mode**: Enabled in tsconfig.json
- **Target**: Node.js 22+ (ES2022)
- **Module system**: ES modules (`.mjs` output)
- **Type checking**: Strict, with noUnusedLocals, noUnusedParameters, noImplicitReturns

### Imports and Exports
```typescript
// Always use .js extensions for relative imports (ESM requirement)
import { foo } from './bar.js';
import type { Baz } from './types.js';

// Named exports preferred over default
export function myFunction(): void { }
export interface MyInterface { }
export type MyType = string;
```

### Naming Conventions
- **Functions/Variables**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `kebab-case.ts` (e.g., `deep-search.ts`, `config-setup.ts`)

### Type Definitions
Use discriminated unions for result types:
```typescript
export interface SuccessResult {
  success: true;
  data: string;
}

export interface ErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export type Result = SuccessResult | ErrorResult;
```

### Error Handling
```typescript
// Always type errors explicitly
try {
  await someOperation();
} catch (error) {
  const err = error as Error;
  errorLog(`Operation failed: ${err.message}`);
  // Return error result or throw
  return { success: false, error: { code: 'OP_FAILED', message: err.message } };
}
```

### JSDoc Comments
Document all public functions with JSDoc:
```typescript
/**
 * Brief description of function
 *
 * Detailed paragraph explaining behavior and edge cases.
 *
 * @param paramName - Description of parameter
 * @returns Promise resolving to result type
 */
export async function myFunction(paramName: string): Promise<Result> {
  // implementation
}
```

### Logging
Use custom log functions (all write to stderr):
```typescript
import { debugLog, progressLog, warnLog, errorLog } from './config.js';

debugLog('Verbose debug info');  // Only when DEBUG=true
progressLog('Important progress'); // Always logged
warnLog('Warning message');      // Always logged
errorLog('Error message');       // Always logged
```

### File Organization
- `src/index.ts` - Entry point (stdio mode)
- `src/http.ts` - HTTP server entry point
- `src/server.ts` - MCP server setup and tool registration
- `src/search.ts` - Single-round search implementation
- `src/deep-search.ts` - Multi-round deep search implementation
- `src/fetch.ts` - Webpage fetch implementation
- `src/utils.ts` - Shared utility functions
- `src/config.ts` - Configuration and environment variables
- `src/config-setup.ts` - Initial configuration setup

### Async/Await Patterns
```typescript
// Always use async/await over raw promises
export async function myFunction(): Promise<Result> {
  const result = await someAsyncOperation();
  return transformResult(result);
}
```

### Configuration Access
```typescript
import { config } from './config.js';

// Access environment variables via config object
const model = config.geminiModel;
const timeout = config.geminiTimeout;
const isDebug = config.debug;
```

### Path Handling
For ES modules, use `import.meta.url`:
```typescript
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatePath = path.join(__dirname, '..', 'templates', 'file.md');
```

### Child Process Handling
```typescript
import { spawn, type ChildProcess } from 'child_process';

const process = spawn('command', ['arg1', 'arg2'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: config.configDir,
});

// Handle cleanup in finally blocks or on close/error
```

### JSON Parsing with Fallback
The project uses a pattern for extracting JSON from CLI output with fallback strategies:
```typescript
function extractJsonFromOutput(output: string): Record<string, unknown> | null {
  // Strategy 1: Look for ```json ... ``` code blocks
  const fenceMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  // Strategy 2: Look for first {...} pattern
  const objectMatch = output.match(/\{[\s\S]*\}/);
  // Return null if both fail
}
```

### MCP Tool Registration Pattern
```typescript
server.tool(
  'tool_name',  // kebab-case tool names
  'Tool description with usage guidance',
  {
    param: z.string().describe('Parameter description'),
    optionalParam: z.number().optional().describe('Optional param'),
  },
  async ({ param, optionalParam }) => {
    // Implementation
    return {
      content: [{ type: 'text', text: 'result' }],
    };
  }
);
```

### No Linting/Formatting Tools
This project does not use ESLint, Prettier, or similar tools. Follow the patterns in existing files for consistency.

### Environment Variables
All configuration is read from environment variables via `config` object. See README.md for full list. Default values are defined in `src/config.ts`.
