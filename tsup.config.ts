import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points for the two binaries
  entry: {
    index: 'src/index.ts',      // gemini-research-mcp (stdio mode)
    http: 'src/http.ts',        // gemini-research-mcp-http (HTTP mode)
  },

  // Output format: ESM for Node.js 22+
  format: ['esm'],

  // Target: Node 22 (tsup uses esbuild which supports node22)
  target: 'node22',

  // Output directory
  outDir: 'dist',

  // Clean output directory before build
  clean: true,

  // Generate source maps for debugging
  sourcemap: true,

  // TypeScript configuration
  tsconfig: './tsconfig.json',

  // No splitting (keep bundles self-contained)
  splitting: false,

  // Don't generate TypeScript declaration files (tsup can, but not needed for this use case)
  dts: false,

  // External dependencies (don't bundle npm packages)
  external: [
    '@modelcontextprotocol/sdk',
    'express',
    'zod',
    'dotenv',
  ],

  // Minify output
  minify: false,

  // Define global constants
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
