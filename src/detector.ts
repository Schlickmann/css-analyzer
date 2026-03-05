import OpenAI from 'openai';
import { ClassDefinition, ClassUsage } from './types';

export class SmartDetector {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeUnusedClasses(
    definitions: ClassDefinition[],
    usages: ClassUsage[]
  ): Promise<Map<string, number>> {
    // Create a usage map for quick lookup
    const usageMap = new Map<string, ClassUsage[]>();
    usages.forEach((usage) => {
      const existing = usageMap.get(usage.className) || [];
      existing.push(usage);
      usageMap.set(usage.className, existing);
    });

    // Find potentially unused classes and sort for deterministic batching
    const potentiallyUnused = definitions
      .filter((def) => !usageMap.has(def.className))
      .sort((a, b) => {
        // Sort by file first, then by class name, then by line number
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        if (a.className !== b.className) return a.className.localeCompare(b.className);
        return a.line - b.line;
      });

    console.log(`Found ${potentiallyUnused.length} potentially unused classes...`);
    console.log(`Analyzing with AI for dynamic patterns...`);

    // Confidence scores for each class
    const confidenceMap = new Map<string, number>();

    // For classes not directly found, check with AI for dynamic usage patterns
    if (potentiallyUnused.length > 0) {
      // Group by file to reduce API calls
      const byFile = new Map<string, ClassDefinition[]>();
      potentiallyUnused.forEach((def) => {
        const existing = byFile.get(def.file) || [];
        existing.push(def);
        byFile.set(def.file, existing);
      });

      // Collect all usage contexts for pattern analysis
      const allContexts = usages.map(u => u.context);

      // Process in batches to avoid rate limits
      const batchSize = 20;
      const classNames = potentiallyUnused.map(c => c.className);
      
      for (let i = 0; i < classNames.length; i += batchSize) {
        const batch = classNames.slice(i, i + batchSize);
        const scores = await this.analyzeClassBatch(batch, allContexts);
        scores.forEach((score, className) => {
          confidenceMap.set(className, score);
        });
        
        console.log(`Analyzed ${Math.min(i + batchSize, classNames.length)}/${classNames.length} classes...`);
      }
    }

    return confidenceMap;
  }

  private async analyzeClassBatch(
    classNames: string[],
    usageContexts: string[]
  ): Promise<Map<string, number>> {
    const confidenceMap = new Map<string, number>();

    try {
      const prompt = `You are analyzing CSS class usage in a codebase. Your task is to determine if CSS classes might be used dynamically (through string interpolation, template literals, or computed values).

Classes to analyze:
${classNames.map(c => `- ${c}`).join('\n')}

Sample usage contexts from the codebase:
${usageContexts.slice(0, 50).map(c => `- ${c}`).join('\n')}

For each class name, analyze if it could be generated dynamically in the usage contexts. Consider:
1. Template literals: \`btn-\${variant}\` could generate "btn-primary", "btn-secondary", etc.
2. String concatenation: "icon-" + iconType
3. Partial matches: if the class is "btn-primary-lg", check if "btn-", "primary", or "lg" appear
4. Common naming patterns (e.g., responsive classes like "md:flex", state classes like "hover:bg-blue")

Return a JSON object where each key is a class name and the value is a confidence score (0.0 to 1.0):
- 1.0 = definitely unused (no possible dynamic usage)
- 0.5-0.9 = likely unused but possible dynamic usage
- 0.0-0.4 = likely used dynamically

Return ONLY the JSON object, no explanation.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a code analysis assistant that returns only valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const scores = JSON.parse(content);
        Object.entries(scores).forEach(([className, score]) => {
          confidenceMap.set(className, score as number);
        });
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      // Default to high confidence (likely unused) if API fails
      classNames.forEach((className) => {
        confidenceMap.set(className, 0.8);
      });
    }

    return confidenceMap;
  }

  async checkDynamicPattern(
    className: string,
    allUsages: ClassUsage[]
  ): Promise<{ isDynamic: boolean; confidence: number; reasoning: string }> {
    const contexts = allUsages.map(u => u.context).slice(0, 20);

    try {
      const prompt = `Analyze if the CSS class "${className}" could be generated dynamically in this codebase.

Usage contexts:
${contexts.join('\n')}

Consider:
- Template literals with interpolation
- String concatenation patterns
- Partial class name matches
- Common frameworks (Tailwind, Bootstrap, etc.)

Respond with JSON: { "isDynamic": boolean, "confidence": 0.0-1.0, "reasoning": "brief explanation" }`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a code analysis assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error analyzing dynamic pattern:', error);
    }

    return { isDynamic: false, confidence: 0.8, reasoning: 'Analysis failed' };
  }
}

