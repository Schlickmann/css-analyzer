import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as fs from 'fs';
import { ClassDefinition } from '../types';

export class CSSInJsParser {
  async parseFile(filePath: string): Promise<ClassDefinition[]> {
    const classes: ClassDefinition[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
      });

      traverse(ast, {
        // styled-components: styled.div`...` or styled(Component)`...`
        TaggedTemplateExpression(path) {
          const tag = path.node.tag;
          
          // Check if it's a styled-components or emotion usage
          if (
            (tag.type === 'MemberExpression' && 
             tag.object.type === 'Identifier' && 
             tag.object.name === 'styled') ||
            (tag.type === 'CallExpression' &&
             tag.callee.type === 'Identifier' &&
             tag.callee.name === 'styled')
          ) {
            // Extract class-like patterns from template literal
            const quasi = path.node.quasi;
            const cssContent = quasi.quasis.map(q => q.value.raw).join('');
            const classMatches = cssContent.match(/\.([a-zA-Z0-9_-]+)/g);
            
            if (classMatches) {
              classMatches.forEach((match) => {
                const className = match.substring(1);
                classes.push({
                  className,
                  file: filePath,
                  line: path.node.loc?.start.line || 0,
                  type: 'css-in-js',
                });
              });
            }
          }
        },
        
        // emotion: css`...`
        CallExpression(path) {
          if (
            path.node.callee.type === 'Identifier' &&
            path.node.callee.name === 'css' &&
            path.node.arguments[0]?.type === 'TemplateLiteral'
          ) {
            const quasi = path.node.arguments[0];
            const cssContent = quasi.quasis.map(q => q.value.raw).join('');
            const classMatches = cssContent.match(/\.([a-zA-Z0-9_-]+)/g);
            
            if (classMatches) {
              classMatches.forEach((match) => {
                const className = match.substring(1);
                classes.push({
                  className,
                  file: filePath,
                  line: path.node.loc?.start.line || 0,
                  type: 'css-in-js',
                });
              });
            }
          }
        },
      });
    } catch (error) {
      // Silently skip files that can't be parsed
      // console.error(`Error parsing JS/TS file ${filePath}:`, error);
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

