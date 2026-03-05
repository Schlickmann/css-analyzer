import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import ignore from 'ignore';
import { CSSParser } from './parsers/cssParser';
import { CSSInJsParser } from './parsers/cssInJsParser';
import { UsageScanner } from './parsers/usageScanner';
import { SmartDetector } from './detector';
import { ExcelReporter } from './reporter';
import {
  ClassDefinition,
  ClassUsage,
  AnalysisResult,
  UnusedClass,
  CliOptions,
} from './types';

export class Analyzer {
  private cssParser: CSSParser;
  private cssInJsParser: CSSInJsParser;
  private usageScanner: UsageScanner;
  private detector: SmartDetector;
  private reporter: ExcelReporter;

  constructor(apiKey: string) {
    this.cssParser = new CSSParser();
    this.cssInJsParser = new CSSInJsParser();
    this.usageScanner = new UsageScanner();
    this.detector = new SmartDetector(apiKey);
    this.reporter = new ExcelReporter();
  }

  private parseGitignore(repoPath: string): string[] {
    const gitignorePath = path.join(repoPath, '.gitignore');
    
    if (!fs.existsSync(gitignorePath)) {
      console.log('No .gitignore file found in the repository');
      return [];
    }

    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      const lines = gitignoreContent.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
      
      console.log(`Loaded ${lines.length} patterns from .gitignore`);
      return lines;
    } catch (error) {
      console.warn(`Warning: Could not read .gitignore file: ${error}`);
      return [];
    }
  }

  async analyze(options: CliOptions): Promise<void> {
    console.log('Starting CSS analysis...');
    console.log(`Repository path: ${options.path}`);
    console.log(`Exclude patterns: ${options.exclude.join(', ')}`);
    console.log('');

    // Parse .gitignore patterns
    const gitignorePatterns = this.parseGitignore(options.path);
    const combinedExcludes = [...options.exclude, ...gitignorePatterns];
    console.log('');

    // Find all relevant files
    const cssFiles = await this.findFiles(options.path, [
      '**/*.css',
      '**/*.scss',
      '**/*.less',
    ], combinedExcludes);

    const jsFiles = await this.findFiles(options.path, [
      '**/*.js',
      '**/*.jsx',
      '**/*.ts',
      '**/*.tsx',
    ], combinedExcludes);

    const htmlFiles = await this.findFiles(options.path, [
      '**/*.html',
      '**/*.htm',
    ], combinedExcludes);

    console.log(`Found ${cssFiles.length} CSS files`);
    console.log(`Found ${jsFiles.length} JS/TS files`);
    console.log(`Found ${htmlFiles.length} HTML files`);
    console.log('');

    // Parse CSS definitions
    console.log('Parsing CSS files...');
    const cssDefinitions = await this.cssParser.parseFiles(cssFiles);
    console.log(`Extracted ${cssDefinitions.length} CSS class definitions`);

    // Parse CSS-in-JS definitions
    console.log('Parsing CSS-in-JS files...');
    const cssInJsDefinitions = await this.cssInJsParser.parseFiles(jsFiles);
    console.log(`Extracted ${cssInJsDefinitions.length} CSS-in-JS class definitions`);

    // Combine all definitions and sort for deterministic ordering
    const allDefinitions = [...cssDefinitions, ...cssInJsDefinitions].sort((a, b) => {
      // Sort by file first, then by class name, then by line number
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.line - b.line;
    });
    console.log(`Total class definitions: ${allDefinitions.length}`);
    console.log('');

    // Scan for usage
    console.log('Scanning for class usage...');
    const allSourceFiles = [...jsFiles, ...htmlFiles];
    const usages = await this.usageScanner.scanFiles(allSourceFiles);
    console.log(`Found ${usages.length} class usages`);
    console.log('');

    // Analyze with AI
    console.log('Analyzing unused classes with AI...');
    const confidenceScores = await this.detector.analyzeUnusedClasses(
      allDefinitions,
      usages
    );

    // Build results
    const result = this.buildAnalysisResult(
      allDefinitions,
      usages,
      confidenceScores,
      options.confidence
    );

    console.log('');
    console.log('=== Analysis Complete ===');
    console.log(`Total classes: ${result.totalClasses}`);
    console.log(`Used classes: ${result.usedClasses}`);
    console.log(`Unused classes (confidence >= ${options.confidence}): ${result.unusedClasses.length}`);
    console.log('');

    // Generate Excel report
    console.log('Generating Excel report...');
    await this.reporter.generateReport(result, options.output);
  }

  private async findFiles(
    basePath: string,
    patterns: string[],
    exclude: string[]
  ): Promise<string[]> {
    const allFiles: string[] = [];

    // Create ignore instance and add patterns
    const ig = ignore();
    exclude.forEach(pattern => {
      ig.add(pattern);
    });

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: basePath,
        absolute: true,
        ignore: exclude.map(e => {
          // Handle patterns that are already glob-like
          if (e.includes('*') || e.includes('/')) {
            return e;
          }
          // For simple directory names, exclude them anywhere
          return `**/${e}/**`;
        }),
      });

      // Additional filtering using ignore package for .gitignore patterns
      const filtered = files.filter(file => {
        const relativePath = path.relative(basePath, file);
        return !ig.ignores(relativePath);
      });

      allFiles.push(...filtered);
    }

    // Remove duplicates and sort for deterministic ordering
    return [...new Set(allFiles)].sort();
  }

  private buildAnalysisResult(
    definitions: ClassDefinition[],
    usages: ClassUsage[],
    confidenceScores: Map<string, number>,
    minConfidence: number
  ): AnalysisResult {
    // Create usage set for quick lookup
    const usageSet = new Set(usages.map(u => u.className));

    // Find unused classes
    const unusedClasses: UnusedClass[] = [];
    const usedClassNames = new Set<string>();

    definitions.forEach((def) => {
      if (usageSet.has(def.className)) {
        usedClassNames.add(def.className);
      } else {
        const confidence = confidenceScores.get(def.className) || 0.8;
        if (confidence >= minConfidence) {
          unusedClasses.push({
            className: def.className,
            definedIn: def.file,
            line: def.line,
            type: def.type,
            confidence,
          });
        } else {
          // Low confidence means likely used dynamically
          usedClassNames.add(def.className);
        }
      }
    });

    // Build statistics
    const statsByType: Record<string, { total: number; unused: number }> = {};
    const statsByFile: Record<string, { total: number; unused: number }> = {};

    definitions.forEach((def) => {
      // By type
      if (!statsByType[def.type]) {
        statsByType[def.type] = { total: 0, unused: 0 };
      }
      statsByType[def.type].total++;

      // By file
      if (!statsByFile[def.file]) {
        statsByFile[def.file] = { total: 0, unused: 0 };
      }
      statsByFile[def.file].total++;
    });

    unusedClasses.forEach((unused) => {
      statsByType[unused.type].unused++;
      statsByFile[unused.definedIn].unused++;
    });

    // Sort unused classes for deterministic output
    unusedClasses.sort((a, b) => {
      if (a.definedIn !== b.definedIn) return a.definedIn.localeCompare(b.definedIn);
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.line - b.line;
    });

    return {
      totalClasses: definitions.length,
      usedClasses: usedClassNames.size,
      unusedClasses,
      stats: {
        byType: statsByType,
        byFile: statsByFile,
      },
    };
  }
}

