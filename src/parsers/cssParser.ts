import postcss from 'postcss';
import * as postcssScss from 'postcss-scss';
import * as fs from 'fs';
import { ClassDefinition } from '../types';

export class CSSParser {
  async parseFile(filePath: string): Promise<ClassDefinition[]> {
    const classes: ClassDefinition[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const isCssModule = filePath.includes('.module.css') || filePath.includes('.module.scss');
    const isScss = filePath.endsWith('.scss') || filePath.endsWith('.less');

    try {
      const root = postcss.parse(content, { 
        from: filePath,
        ...(isScss ? { syntax: postcssScss } : {})
      });

      root.walkRules((rule) => {
        const selectors = rule.selector.split(',').map(s => s.trim());
        
        selectors.forEach((selector) => {
          // Extract class names from selector
          const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g);
          
          if (classMatches) {
            classMatches.forEach((match) => {
              const className = match.substring(1); // Remove the dot
              classes.push({
                className,
                file: filePath,
                line: rule.source?.start?.line || 0,
                type: isCssModule ? 'css-module' : 'css',
              });
            });
          }
        });
      });
    } catch (error) {
      console.error(`Error parsing CSS file ${filePath}:`, error);
    }

    return classes;
  }

  async parseFiles(filePaths: string[]): Promise<ClassDefinition[]> {
    const allClasses: ClassDefinition[] = [];
    
    for (const filePath of filePaths) {
      const classes = await this.parseFile(filePath);
      allClasses.push(...classes);
    }
    
    return allClasses;
  }
}

