#!/usr/bin/env node
/**
 * Test script for deep_research tool
 * Verifies that the research functionality works end-to-end
 */

import { deepResearch, type ResearchParams } from './src/deep-research.js';
import { config, debugLog, progressLog, errorLog } from './src/config.js';

// Enable debug logging for testing
config.debug = true;

/**
 * Test cases
 */
const testCases: Array<{ name: string; params: ResearchParams; timeout: number }> = [
  {
    name: 'Concise research test',
    params: {
      topic: 'What are the main benefits of TypeScript over JavaScript for web development in 2024?',
      depth: 'concise'
    },
    timeout: 120000,
  },
];

/**
 * Run a single test case
 */
async function runTest(
  testName: string,
  params: ResearchParams,
  timeout: number
): Promise<boolean> {
  progressLog(`\n=== Running test: ${testName} ===`);
  progressLog(`Topic: "${params.topic}"`);
  progressLog(`Depth: "${params.depth}"`);

  const startTime = Date.now();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), timeout);
    });

    // Run the test
    const result = await Promise.race([deepResearch(params), timeoutPromise]);

    const duration = Date.now() - startTime;
    progressLog(`Test completed in ${duration}ms`);

    // Check result
    if (result.success) {
      progressLog(`✅ SUCCESS: Report generated (${result.report.length} chars)`);
      if (config.debug) {
        console.log('\n--- Report Preview (first 500 chars) ---');
        console.log(result.report.substring(0, 500) + '...');
        console.log('--- End Preview ---\n');
      }
      if (result.metadata.sources_visited) {
        progressLog(`Sources visited: ${result.metadata.sources_visited.length}`);
      }
      if (result.metadata.iterations) {
        progressLog(`Iterations: ${result.metadata.iterations}`);
      }
      return true;
    } else {
      errorLog(`❌ FAILED: ${result.error.code} - ${result.error.message}`);
      if (result.error.details) {
        console.log(`Details: ${result.error.details}`);
      }
      return false;
    }
  } catch (error) {
    const err = error as Error;
    errorLog(`❌ ERROR: ${err.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function main(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Gemini Research MCP - deep_research Tool Test           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  progressLog('Configuration:');
  console.log(`  - Model: ${config.geminiModel}`);
  console.log(`  - Timeout: ${config.geminiTimeout}ms`);
  console.log(`  - Config dir: ${config.configDir}`);
  console.log(`  - Firecrawl API: ${config.firecrawlApiKey ? 'Set' : 'Not set'}`);

  // Check if gemini CLI is available
  const { spawn } = await import('child_process');
  const geminiCheck = spawn('gemini', ['--version'], { stdio: 'pipe' });
  await new Promise<void>((resolve) => {
    geminiCheck.on('close', (code) => {
      if (code === 0) {
        progressLog('Gemini CLI: Available ✅');
      } else {
        errorLog('Gemini CLI: NOT available ❌');
        console.log('\n⚠️  Warning: Tests will fail without Gemini CLI installed.');
        console.log('Install via: npm install -g @google/gemini-cli');
      }
      resolve();
    });
  });

  // Check config directory
  const { access } = await import('fs/promises');
  try {
    await access(config.geminiSettingsPath);
    progressLog(`Gemini settings: Found ✅`);
  } catch {
    progressLog(`Gemini settings: Will be created on first run ⚠️`);
  }

  // Run tests
  const results: Array<{ name: string; passed: boolean }> = [];

  for (const testCase of testCases) {
    const passed = await runTest(testCase.name, testCase.params, testCase.timeout);
    results.push({ name: testCase.name, passed });
  }

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Test Summary                                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status}: ${result.name}`);
  });

  console.log(`\n  Total: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n  🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n  ⚠️  Some tests failed. Check output above for details.');
    process.exit(1);
  }
}

// Run the tests
main().catch((error) => {
  errorLog(`Fatal error: ${error}`);
  process.exit(1);
});
