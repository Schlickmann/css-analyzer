export interface ClassDefinition {
  className: string;
  file: string;
  line: number;
  type: 'css' | 'css-module' | 'css-in-js' | 'tailwind';
}

export interface ClassUsage {
  className: string;
  file: string;
  line: number;
  context: string;
}

export interface UnusedClass {
  className: string;
  definedIn: string;
  line: number;
  type: string;
  confidence: number;
}

export interface AnalysisResult {
  totalClasses: number;
  usedClasses: number;
  unusedClasses: UnusedClass[];
  stats: {
    byType: Record<string, { total: number; unused: number }>;
    byFile: Record<string, { total: number; unused: number }>;
  };
}

export interface CliOptions {
  path: string;
  output: string;
  apiKey?: string;
  exclude: string[];
  confidence: number;
}

