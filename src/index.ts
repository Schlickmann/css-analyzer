#!/usr/bin/env node

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Analyzer } from './analyzer';
import { CliOptions } from './types';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('css-analyzer')
  .description('Analyze repositories for unused CSS classes')
  .version('1.0.0')
  .requiredOption('-p, --path <path>', 'Path to the cloned repository')
  .option('-o, --output <file>', 'Output Excel file path', 'unused-classes.xlsx')
  .option('-k, --api-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env var)')
  .option(
    '-e, --exclude <patterns>',
    'Comma-separated patterns to exclude',
    'node_modules,dist,build,.git,.next,out,coverage,test-results,playwright-report,.playwright,playwright,cypress,__tests__,*.test.*,*.spec.*,e2e,tests,__e2e__,test,artifacts'
  )
  .option(
    '-c, --confidence <value>',
    'Minimum confidence threshold (0-1)',
    '0.7'
  )
  .parse(process.argv);

const options = program.opts();

// Validate repository path
const repoPath = path.resolve(options.path);
if (!fs.existsSync(repoPath)) {
  console.error(`Error: Repository path does not exist: ${repoPath}`);
  process.exit(1);
}

if (!fs.statSync(repoPath).isDirectory()) {
  console.error(`Error: Path is not a directory: ${repoPath}`);
  process.exit(1);
}

// Get API key
const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OpenAI API key is required.');
  console.error('Provide it via --api-key flag or OPENAI_API_KEY environment variable.');
  process.exit(1);
}

// Parse exclude patterns
const excludePatterns = options.exclude.split(',').map((s: string) => s.trim());

// Parse confidence threshold
const confidence = parseFloat(options.confidence);
if (isNaN(confidence) || confidence < 0 || confidence > 1) {
  console.error('Error: Confidence must be a number between 0 and 1');
  process.exit(1);
}

// Prepare CLI options
const cliOptions: CliOptions = {
  path: repoPath,
  output: path.resolve(options.output),
  apiKey,
  exclude: excludePatterns,
  confidence,
};

// Run the analyzer
async function main() {
  try {
    const analyzer = new Analyzer(apiKey);
    await analyzer.analyze(cliOptions);
    console.log('\n✓ Analysis completed successfully!');
  } catch (error) {
    console.error('\n✗ Analysis failed:', error);
    process.exit(1);
  }
}

main();

