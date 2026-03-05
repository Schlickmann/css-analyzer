# CSS Analyzer CLI

A command-line tool that analyzes repositories to detect unused CSS classes across traditional CSS, CSS-in-JS, and Tailwind CSS.

## Features

- Detects unused classes in traditional CSS, CSS modules, Tailwind, and CSS-in-JS
- Uses OpenAI for intelligent detection of dynamic class patterns
- Generates Excel reports with detailed analysis
- Supports locally cloned repositories

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

```bash
npm run dev -- --path /path/to/repository --output report.xlsx
```

Or after building:

```bash
node dist/index.js --path /path/to/repository --output report.xlsx
```

### Options

- `--path <path>` - Path to the cloned repository (required)
- `--output <file>` - Output Excel file path (default: unused-classes.xlsx)
- `--api-key <key>` - OpenAI API key (alternative to env var)
- `--exclude <patterns>` - Comma-separated patterns to exclude (default: node_modules,dist,build,.git)
- `--confidence <value>` - Minimum confidence threshold 0-1 (default: 0.7)

## Example

```bash
npm run dev -- --path ~/projects/my-app --output analysis.xlsx
```

### Test with Sample Repository

A test repository is included. To try it out:

```bash
npm run dev -- --path ./test-repo --output test-report.xlsx
```

This should detect `unused-class`, `sidebar`, and `unused-sidebar-item` as unused CSS classes.
