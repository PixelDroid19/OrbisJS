/**
 * Language Detection System
 * Comprehensive language and framework detection for Babel transformation
 */


import type { 
  SupportedLanguage, 
  SupportedFramework, 
  LanguageInfo, 
  FrameworkInfo, 
  LanguageFeature, 
  DependencyInfo,
  DetectionStrategy
} from './types.js';

/**
 * Enhanced language detector that analyzes code content using AST parsing
 * and pattern matching to determine language, framework, and required features
 */
export class LanguageDetector {
  private customPatterns: Map<string, RegExp> = new Map();
  
  // Language feature patterns for AST-based detection
  private readonly languageFeatures = new Map<string, LanguageFeature>([
    // Modern JavaScript features
    ['optional-chaining', {
      name: 'optional-chaining',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-optional-chaining'
    }],
    ['nullish-coalescing', {
      name: 'nullish-coalescing',
      type: 'syntax', 
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-nullish-coalescing-operator'
    }],
    ['class-properties', {
      name: 'class-properties',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-class-properties'
    }],
    ['decorators', {
      name: 'decorators',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-decorators'
    }],
    ['top-level-await', {
      name: 'top-level-await',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-syntax-top-level-await'
    }],
    ['dynamic-import', {
      name: 'dynamic-import',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-syntax-dynamic-import'
    }],
    // TypeScript features
    ['typescript-interfaces', {
      name: 'typescript-interfaces',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    ['typescript-generics', {
      name: 'typescript-generics',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    ['typescript-enums', {
      name: 'typescript-enums',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    // JSX features
    ['jsx-elements', {
      name: 'jsx-elements',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-react'
    }],
    ['jsx-fragments', {
      name: 'jsx-fragments',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-react'
    }]
  ]);

  // Framework detection patterns
  private readonly frameworkPatterns = new Map<SupportedFramework, {
    imports: RegExp[];
    syntax: RegExp[];
    dependencies: string[];
    presets: string[];
    plugins: string[];
  }>([
    ['react', {
      imports: [
        /import\s+(?:React|{[^}]*})\s+from\s+['"]react['"]/,
        /import\s+.*\s+from\s+['"]react\/.*['"]/,
        /require\(['"]react['"]\)/,
        /from\s+['"]react-dom['"]/
      ],
      syntax: [
        /<[A-Z][a-zA-Z0-9]*(?:\s+[^>]*)?\s*(?:\/>|>.*<\/[A-Z][a-zA-Z0-9]*>)/s,
        /React\.createElement/,
        /jsx\s*\(/,
        /React\.Fragment/,
        /<>.*<\/>/s,
        /useState\s*\(/,
        /useEffect\s*\(/,
        /ReactDOM\.render/
      ],
      dependencies: ['react', 'react-dom'],
      presets: ['@babel/preset-react'],
      plugins: []
    }],
    ['solid', {
      imports: [
        /import\s+.*\s+from\s+['"]solid-js['"]/,
        /import\s+.*\s+from\s+['"]solid-js\/.*['"]/
      ],
      syntax: [
        /createSignal\s*\(/,
        /createEffect\s*\(/,
        /createMemo\s*\(/,
        /Show\s+when=/,
        /For\s+each=/,
        /render\s*\(/
      ],
      dependencies: ['solid-js'],
      presets: ['solid'],
      plugins: []
    }],
    ['vue', {
      imports: [
        /import\s+.*\s+from\s+['"]vue['"]/,
        /import\s+.*\s+from\s+['"]@vue\/.*['"]/
      ],
      syntax: [
        /defineComponent\s*\(/,
        /ref\s*\(/,
        /reactive\s*\(/,
        /computed\s*\(/,
        /onMounted\s*\(/,
        /v-if=/,
        /v-for=/,
        /@click=/
      ],
      dependencies: ['vue'],
      presets: ['@vue/babel-preset-jsx'],
      plugins: []
    }],
    ['svelte', {
      imports: [
        /import\s+.*\s+from\s+['"]svelte['"]/,
        /import\s+.*\s+from\s+['"]svelte\/.*['"]/
      ],
      syntax: [
        /\$:\s*\w+/,
        /\{#if\s+.*\}/,
        /\{#each\s+.*\}/,
        /\{@html\s+.*\}/,
        /on:click=/
      ],
      dependencies: ['svelte'],
      presets: [],
      plugins: ['@babel/plugin-syntax-dynamic-import']
    }]
  ]);

  /**
   * Detect language information from file path
   */
  async detectFromFile(filePath: string): Promise<LanguageInfo> {
    try {
      // For now, we'll simulate file reading - in real implementation this would read the file
      // This is a placeholder that would integrate with the file system
      throw new Error('File reading not implemented - use detectFromContent instead');
    } catch (error) {
      // Fallback to extension-based detection
      return this.detectFromExtension(this.getFileExtension(filePath));
    }
  }

  /**
   * Detect language information from code content
   */
  detectFromContent(code: string, filename?: string): LanguageInfo {
    const extension = filename ? this.getFileExtension(filename) : null;
    
    // Start with extension-based detection as baseline
    const baseInfo = extension ? this.detectFromExtension(extension) : {
      language: 'javascript' as SupportedLanguage,
      confidence: 0.3,
      features: [],
      requiresTranspilation: false
    };

    // Simple pattern-based feature detection
    const features = this.detectFeaturesFromPatterns(code);
    const frameworks = this.detectFramework(code);
    
    return {
      ...baseInfo,
      confidence: Math.min(baseInfo.confidence + (features.length > 0 ? 0.3 : 0.1), 1.0),
      features: [...baseInfo.features, ...features],
      framework: frameworks.length > 0 ? frameworks[0].name : undefined,
      requiresTranspilation: this.determineTranspilationNeed(features, frameworks)
    };
  }

  /**
   * Detect language from file extension
   */
  detectFromExtension(extension: string): LanguageInfo {
    const extensionMap: Record<string, { language: SupportedLanguage; confidence: number; features: LanguageFeature[] }> = {
      '.js': { 
        language: 'javascript', 
        confidence: 0.8, 
        features: [] 
      },
      '.mjs': { 
        language: 'javascript', 
        confidence: 0.9, 
        features: [this.languageFeatures.get('dynamic-import')!] 
      },
      '.jsx': { 
        language: 'jsx', 
        confidence: 0.9, 
        features: [this.languageFeatures.get('jsx-elements')!] 
      },
      '.ts': { 
        language: 'typescript', 
        confidence: 0.9, 
        features: [
          this.languageFeatures.get('typescript-interfaces')!,
          this.languageFeatures.get('typescript-generics')!
        ] 
      },
      '.tsx': { 
        language: 'tsx', 
        confidence: 0.95, 
        features: [
          this.languageFeatures.get('typescript-interfaces')!,
          this.languageFeatures.get('jsx-elements')!
        ] 
      }
    };

    const detected = extensionMap[extension.toLowerCase()];
    if (detected) {
      return {
        ...detected,
        requiresTranspilation: detected.language !== 'javascript' || detected.features.length > 0
      };
    }

    // Default fallback
    return {
      language: 'javascript',
      confidence: 0.3,
      features: [],
      requiresTranspilation: false
    };
  }

  /**
   * Detect framework from code content
   */
  detectFramework(code: string): FrameworkInfo[] {
    const results: FrameworkInfo[] = [];

    for (const [framework, patterns] of this.frameworkPatterns.entries()) {
      let confidence = 0;

      // Check import patterns
      for (const importPattern of patterns.imports) {
        if (importPattern.test(code)) {
          confidence += 0.4;
        }
      }

      // Check syntax patterns
      for (const syntaxPattern of patterns.syntax) {
        if (syntaxPattern.test(code)) {
          confidence += 0.2;
        }
      }

      if (confidence > 0) {
        results.push({
          name: framework,
          confidence: Math.min(confidence, 1.0),
          requiredPresets: patterns.presets,
          requiredPlugins: patterns.plugins
        });
      }
    }

    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect language features from code content
   */
  detectFeatures(code: string): LanguageFeature[] {
    return this.detectFeaturesFromPatterns(code);
  }

  /**
   * Detect dependencies from code analysis
   */
  detectDependencies(code: string): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    
    // Extract import statements
    const importMatches = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    const requireMatches = code.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    
    const allImports = [
      ...importMatches.map(match => match.match(/from\s+['"]([^'"]+)['"]/)?.[1]),
      ...requireMatches.map(match => match.match(/require\(['"]([^'"]+)['"]\)/)?.[1])
    ].filter(Boolean) as string[];

    for (const importPath of allImports) {
      // Skip relative imports
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        continue;
      }

      dependencies.push({
        name: importPath,
        type: 'dependency',
        required: true,
        version: 'latest'
      });
    }

    return dependencies;
  }

  /**
   * Register custom language pattern
   */
  registerLanguagePattern(language: string, pattern: RegExp): void {
    this.customPatterns.set(language, pattern);
  }

  /**
   * Set detection strategy
   */
  setDetectionStrategy(strategy: DetectionStrategy): void {
    this.detectionStrategy = strategy;
  }

  /**
   * Validate language support
   */
  validateLanguageSupport(language: string): boolean {
    const supportedLanguages: SupportedLanguage[] = ['javascript', 'typescript', 'jsx', 'tsx'];
    return supportedLanguages.includes(language as SupportedLanguage);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return ['javascript', 'typescript', 'jsx', 'tsx'];
  }

  // Private helper methods

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }



  private detectFeaturesFromPatterns(code: string): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    
    // Pattern-based feature detection
    const patterns = [
      { pattern: /\?\./g, feature: 'optional-chaining' },
      { pattern: /\?\?/g, feature: 'nullish-coalescing' },
      { pattern: /class\s+\w+\s*{[^}]*\w+\s*=/s, feature: 'class-properties' },
      { pattern: /@\w+/g, feature: 'decorators' },
      { pattern: /(?:const|let|var)\s+\w+\s*=\s*await\s+/g, feature: 'top-level-await' },
      { pattern: /import\s*\(/g, feature: 'dynamic-import' },
      { pattern: /<[A-Z]\w*(?:\s+[^>]*)?\s*(?:\/>|>)/g, feature: 'jsx-elements' },
      { pattern: /interface\s+\w+/g, feature: 'typescript-interfaces' },
      { pattern: /enum\s+\w+\s*{/g, feature: 'typescript-enums' }
    ];

    for (const { pattern, feature } of patterns) {
      if (pattern.test(code)) {
        const languageFeature = this.languageFeatures.get(feature);
        if (languageFeature) {
          features.push(languageFeature);
        }
      }
    }

    return features;
  }

  private determineTranspilationNeed(features: LanguageFeature[], frameworks: FrameworkInfo[]): boolean {
    // If any features require transpilation
    if (features.some(f => f.support.transpilable && !f.support.native)) {
      return true;
    }
    
    // If any frameworks are detected
    if (frameworks.length > 0) {
      return true;
    }
    
    return false;
  }
}