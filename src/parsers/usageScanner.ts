import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import { ClassUsage } from '../types';

export class UsageScanner {
  async scanFile(filePath: string): Promise<ClassUsage[]> {
    const usages: ClassUsage[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');

    // For HTML files, use regex
    if (filePath.endsWith('.html') || filePath.endsWith('.htm')) {
      return this.scanHTMLFile(filePath, content);
    }

    // For JS/TS/JSX/TSX files, use AST parsing
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });

      const self = this;
      traverse(ast, {
        JSXAttribute(path) {
          if (
            path.node.name.name === 'className' ||
            path.node.name.name === 'class'
          ) {
            const value = path.node.value;
            
            if (value?.type === 'StringLiteral') {
              // Simple string: className="btn primary"
              const classes = value.value.split(/\s+/).filter(Boolean);
              const lineNumber = path.node.loc?.start.line || 0;
              const ctx = self.getContext(content, lineNumber);
              classes.forEach((className: string) => {
                usages.push({
                  className,
                  file: filePath,
                  line: lineNumber,
                  context: ctx,
                });
              });
            } else if (value?.type === 'JSXExpressionContainer') {
              // Dynamic: className={...}
              const expression = value.expression;
              const lineNumber = path.node.loc?.start.line || 0;
              const context = self.getContext(content, lineNumber);
              
              // Extract any string literals or identifiers
              self.extractClassesFromExpression(expression, filePath, lineNumber, context, usages);
            }
          }
        },

        // Handle classList.add/remove/toggle
        CallExpression(path) {
          if (
            path.node.callee.type === 'MemberExpression' &&
            path.node.callee.property.type === 'Identifier' &&
            ['add', 'remove', 'toggle', 'contains'].includes(path.node.callee.property.name) &&
            path.node.callee.object.type === 'MemberExpression' &&
            path.node.callee.object.property.type === 'Identifier' &&
            path.node.callee.object.property.name === 'classList'
          ) {
            path.node.arguments.forEach((arg) => {
              if (arg.type === 'StringLiteral') {
                const lineNumber = path.node.loc?.start.line || 0;
                usages.push({
                  className: arg.value,
                  file: filePath,
                  line: lineNumber,
                  context: self.getContext(content, lineNumber),
                });
              }
            });
          }
        },

        // Handle CSS modules: styles.className
        MemberExpression(path) {
          if (
            path.node.object.type === 'Identifier' &&
            (path.node.object.name === 'styles' || path.node.object.name === 'classes') &&
            path.node.property.type === 'Identifier'
          ) {
            const lineNumber = path.node.loc?.start.line || 0;
            usages.push({
              className: path.node.property.name,
              file: filePath,
              line: lineNumber,
              context: self.getContext(content, lineNumber),
            });
          }
        },
      });
    } catch (error) {
      // Silently skip files that can't be parsed
      // console.error(`Error scanning file ${filePath}:`, error);
    }

    return usages;
  }

  private scanHTMLFile(filePath: string, content: string): ClassUsage[] {
    const usages: ClassUsage[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const classMatches = line.match(/class=["']([^"']+)["']/g);
      
      if (classMatches) {
        classMatches.forEach((match) => {
          const classValue = match.match(/class=["']([^"']+)["']/)?.[1];
          if (classValue) {
            const classes = classValue.split(/\s+/).filter(Boolean);
            classes.forEach((className) => {
              usages.push({
                className,
                file: filePath,
                line: index + 1,
                context: line.trim(),
              });
            });
          }
        });
      }
    });
    
    return usages;
  }

  private extractClassesFromExpression(
    expression: any,
    filePath: string,
    line: number,
    context: string,
    usages: ClassUsage[]
  ): void {
    if (expression.type === 'StringLiteral') {
      const classes = expression.value.split(/\s+/).filter(Boolean);
      classes.forEach((className: string) => {
        usages.push({ className, file: filePath, line, context });
      });
    } else if (expression.type === 'TemplateLiteral') {
      expression.quasis.forEach((quasi: any) => {
        const classes = quasi.value.raw.split(/\s+/).filter(Boolean);
        classes.forEach((className: string) => {
          usages.push({ className, file: filePath, line, context });
        });
      });
    } else if (expression.type === 'ArrayExpression') {
      expression.elements?.forEach((element: any) => {
        if (element) {
          this.extractClassesFromExpression(element, filePath, line, context, usages);
        }
      });
    } else if (expression.type === 'ObjectExpression') {
      expression.properties?.forEach((prop: any) => {
        if (prop.key?.type === 'StringLiteral') {
          usages.push({ className: prop.key.value, file: filePath, line, context });
        } else if (prop.key?.type === 'Identifier') {
          usages.push({ className: prop.key.name, file: filePath, line, context });
        }
      });
    }
  }

  private getContext(content: string, line: number): string {
    const lines = content.split('\n');
    const targetLine = lines[line - 1] || '';
    return targetLine.trim().substring(0, 100);
  }

  async scanFiles(filePaths: string[]): Promise<ClassUsage[]> {
    const allUsages: ClassUsage[] = [];
    
    for (const filePath of filePaths) {
      const usages = await this.scanFile(filePath);
      allUsages.push(...usages);
    }
    
    return allUsages;
  }
}

