/**
 * Advanced Feature Detection System
 * Sophisticated AST-based detection for modern JavaScript/TypeScript features
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { 
  LanguageFeature, 
  DependencyInfo, 
  FeatureSupport,
  SupportedFramework 
} from './types';

/**
 * Advanced feature detector that uses AST traversal for accurate detection
 */
export class AdvancedFeatureDetector {
  private readonly modernJSFeatures = new Map<string, LanguageFeature>([
    // ES2020+ features
    ['optional-chaining', {
      name: 'optional-chaining',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2020' },
      requiredPlugin: '@babel/plugin-proposal-optional-chaining'
    }],
    ['nullish-coalescing', {
      name: 'nullish-coalescing',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2020' },
      requiredPlugin: '@babel/plugin-proposal-nullish-coalescing-operator'
    }],
    ['bigint', {
      name: 'bigint',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2020' },
      requiredPlugin: '@babel/plugin-syntax-bigint'
    }],
    ['dynamic-import', {
      name: 'dynamic-import',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2020' },
      requiredPlugin: '@babel/plugin-syntax-dynamic-import'
    }],
    ['top-level-await', {
      name: 'top-level-await',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2022' },
      requiredPlugin: '@babel/plugin-syntax-top-level-await'
    }],
    
    // Class features
    ['class-properties', {
      name: 'class-properties',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2022' },
      requiredPlugin: '@babel/plugin-proposal-class-properties'
    }],
    ['private-methods', {
      name: 'private-methods',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2022' },
      requiredPlugin: '@babel/plugin-proposal-private-methods'
    }],
    ['static-class-features', {
      name: 'static-class-features',
      type: 'syntax',
      support: { native: false, transpilable: true, minimumVersion: 'ES2022' },
      requiredPlugin: '@babel/plugin-proposal-static-class-features'
    }],
    ['decorators', {
      name: 'decorators',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-decorators'
    }],
    
    // Advanced features
    ['pipeline-operator', {
      name: 'pipeline-operator',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-pipeline-operator'
    }],
    ['partial-application', {
      name: 'partial-application',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-partial-application'
    }],
    ['record-tuple', {
      name: 'record-tuple',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/plugin-proposal-record-and-tuple'
    }]
  ]);

  private readonly typescriptFeatures = new Map<string, LanguageFeature>([
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
    ['typescript-decorators', {
      name: 'typescript-decorators',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    ['typescript-namespaces', {
      name: 'typescript-namespaces',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    ['typescript-type-assertions', {
      name: 'typescript-type-assertions',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }],
    ['typescript-ambient-declarations', {
      name: 'typescript-ambient-declarations',
      type: 'syntax',
      support: { native: false, transpilable: true },
      requiredPlugin: '@babel/preset-typescript'
    }]
  ]);

  private readonly frameworkFeatures = new Map<SupportedFramework, Map<string, LanguageFeature>>([
    ['react', new Map([
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
      }],
      ['react-hooks', {
        name: 'react-hooks',
        type: 'api',
        support: { native: false, transpilable: true },
        requiredPlugin: '@babel/preset-react'
      }],
      ['react-fast-refresh', {
        name: 'react-fast-refresh',
        type: 'api',
        support: { native: false, transpilable: true },
        requiredPlugin: 'react-refresh/babel'
      }]
    ])],
    ['solid', new Map([
      ['solid-jsx', {
        name: 'solid-jsx',
        type: 'syntax',
        support: { native: false, transpilable: true },
        requiredPlugin: 'babel-preset-solid'
      }],
      ['solid-reactivity', {
        name: 'solid-reactivity',
        type: 'api',
        support: { native: false, transpilable: true },
        requiredPlugin: 'babel-preset-solid'
      }]
    ])],
    ['vue', new Map([
      ['vue-sfc', {
        name: 'vue-sfc',
        type: 'syntax',
        support: { native: false, transpilable: true },
        requiredPlugin: '@vue/babel-preset-jsx'
      }],
      ['vue-composition-api', {
        name: 'vue-composition-api',
        type: 'api',
        support: { native: false, transpilable: true },
        requiredPlugin: '@vue/babel-preset-jsx'
      }]
    ])],
    ['svelte', new Map([
      ['svelte-components', {
        name: 'svelte-components',
        type: 'syntax',
        support: { native: false, transpilable: true },
        requiredPlugin: '@babel/plugin-syntax-dynamic-import'
      }]
    ])]
  ]);

  /**
   * Detect modern JavaScript features using AST analysis
   */
  detectModernJSFeatures(code: string): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    
    try {
      const ast = parse(code, {
        sourceType: 'unambiguous',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'optionalChaining',
          'nullishCoalescingOperator',
          'bigInt',
          'dynamicImport',
          'topLevelAwait',
          'privateIn'
        ]
      });

      if (!ast) return features;

      // Traverse AST to detect features
      traverse(ast, {
        // Optional chaining: obj?.prop
        OptionalMemberExpression: () => {
          const feature = this.modernJSFeatures.get('optional-chaining');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Optional call: func?.()
        OptionalCallExpression: () => {
          const feature = this.modernJSFeatures.get('optional-chaining');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Nullish coalescing: a ?? b
        LogicalExpression: (path) => {
          if (path.node.operator === '??') {
            const feature = this.modernJSFeatures.get('nullish-coalescing');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        },
        
        // BigInt literals: 123n
        BigIntLiteral: () => {
          const feature = this.modernJSFeatures.get('bigint');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Dynamic imports: import()
        Import: () => {
          const feature = this.modernJSFeatures.get('dynamic-import');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Top-level await
        AwaitExpression: (path) => {
          // Check if await is at top level (not inside a function)
          let parent = path.parent;
          let isTopLevel = true;
          
          while (parent) {
            if (parent.type === 'FunctionDeclaration' || 
                parent.type === 'FunctionExpression' || 
                parent.type === 'ArrowFunctionExpression') {
              isTopLevel = false;
              break;
            }
            parent = parent.parent;
          }
          
          if (isTopLevel) {
            const feature = this.modernJSFeatures.get('top-level-await');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        },
        
        // Class properties: class { prop = value }
        ClassProperty: () => {
          const feature = this.modernJSFeatures.get('class-properties');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Private methods: class { #method() {} }
        ClassPrivateMethod: () => {
          const feature = this.modernJSFeatures.get('private-methods');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Static class features: class { static prop = value }
        ClassMethod: (path) => {
          if (path.node.static) {
            const feature = this.modernJSFeatures.get('static-class-features');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        },
        
        // Decorators: @decorator
        Decorator: () => {
          const feature = this.modernJSFeatures.get('decorators');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // Pipeline operator: value |> transform
        BinaryExpression: (path) => {
          if (path.node.operator === '|>') {
            const feature = this.modernJSFeatures.get('pipeline-operator');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        }
      });
      
    } catch (error) {
      console.warn('AST parsing failed for modern JS feature detection:', error);
      // Fallback to pattern-based detection
      return this.detectModernJSFeaturesWithPatterns(code);
    }

    return features;
  }

  /**
   * Detect TypeScript features using AST analysis
   */
  detectTypeScriptFeatures(code: string): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    
    try {
      const ast = parse(code, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'decorators-legacy']
      });

      if (!ast) return features;

      traverse(ast, {
        // TypeScript interfaces
        TSInterfaceDeclaration: () => {
          const feature = this.typescriptFeatures.get('typescript-interfaces');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript enums
        TSEnumDeclaration: () => {
          const feature = this.typescriptFeatures.get('typescript-enums');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript generics
        TSTypeParameterDeclaration: () => {
          const feature = this.typescriptFeatures.get('typescript-generics');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript decorators
        Decorator: () => {
          const feature = this.typescriptFeatures.get('typescript-decorators');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript namespaces (TSModuleDeclaration is the correct visitor name)
        TSModuleDeclaration: () => {
          const feature = this.typescriptFeatures.get('typescript-namespaces');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript type assertions: value as Type
        TSAsExpression: () => {
          const feature = this.typescriptFeatures.get('typescript-type-assertions');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        },
        
        // TypeScript ambient declarations: declare
        TSDeclareFunction: () => {
          const feature = this.typescriptFeatures.get('typescript-ambient-declarations');
          if (feature && !features.includes(feature)) {
            features.push(feature);
          }
        }
      });
      
    } catch (error) {
      console.warn('AST parsing failed for TypeScript feature detection:', error);
      // Fallback to pattern-based detection
      return this.detectTypeScriptFeaturesWithPatterns(code);
    }

    return features;
  }

  /**
   * Detect framework-specific syntax features
   */
  detectFrameworkFeatures(code: string, framework: SupportedFramework): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    const frameworkFeatureMap = this.frameworkFeatures.get(framework);
    
    if (!frameworkFeatureMap) return features;
    
    try {
      const ast = parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript']
      });

      if (!ast) return features;

      traverse(ast, {
        // JSX Elements: <Component />
        JSXElement: () => {
          if (framework === 'react' || framework === 'solid') {
            const feature = frameworkFeatureMap.get('jsx-elements') || frameworkFeatureMap.get('solid-jsx');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        },
        
        // JSX Fragments: <></>
        JSXFragment: () => {
          if (framework === 'react') {
            const feature = frameworkFeatureMap.get('jsx-fragments');
            if (feature && !features.includes(feature)) {
              features.push(feature);
            }
          }
        },
        
        // React Hooks detection (useState, useEffect, etc.)
        CallExpression: (path) => {
          if (framework === 'react' && path.node.callee.type === 'Identifier') {
            const callName = path.node.callee.name;
            if (callName.startsWith('use') && callName.length > 3) {
              const feature = frameworkFeatureMap.get('react-hooks');
              if (feature && !features.includes(feature)) {
                features.push(feature);
              }
            }
          }
          
          // Solid reactivity detection
          if (framework === 'solid' && path.node.callee.type === 'Identifier') {
            const callName = path.node.callee.name;
            if (['createSignal', 'createEffect', 'createMemo', 'createResource'].includes(callName)) {
              const feature = frameworkFeatureMap.get('solid-reactivity');
              if (feature && !features.includes(feature)) {
                features.push(feature);
              }
            }
          }
          
          // Vue Composition API detection
          if (framework === 'vue' && path.node.callee.type === 'Identifier') {
            const callName = path.node.callee.name;
            if (['ref', 'reactive', 'computed', 'watch', 'onMounted'].includes(callName)) {
              const feature = frameworkFeatureMap.get('vue-composition-api');
              if (feature && !features.includes(feature)) {
                features.push(feature);
              }
            }
          }
        }
      });
      
    } catch (error) {
      console.warn('AST parsing failed for framework feature detection:', error);
      // Fallback to pattern-based detection
      return this.detectFrameworkFeaturesWithPatterns(code, framework);
    }

    return features;
  }

  /**
   * Analyze dependencies based on detected features
   */
  analyzeDependencyRequirements(features: LanguageFeature[]): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const pluginSet = new Set<string>();
    
    for (const feature of features) {
      if (feature.requiredPlugin && !pluginSet.has(feature.requiredPlugin)) {
        pluginSet.add(feature.requiredPlugin);
        
        dependencies.push({
          name: feature.requiredPlugin,
          type: feature.requiredPlugin.includes('preset') ? 'babel-preset' : 'babel-plugin',
          required: true,
          version: 'latest'
        });
      }
    }
    
    return dependencies;
  }

  // Fallback pattern-based detection methods
  private detectModernJSFeaturesWithPatterns(code: string): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    
    const patterns = [
      { pattern: /\?\./g, feature: 'optional-chaining' },
      { pattern: /\?\?/g, feature: 'nullish-coalescing' },
      { pattern: /\d+n\b/g, feature: 'bigint' },
      { pattern: /import\s*\(/g, feature: 'dynamic-import' },
      { pattern: /(?:const|let|var)\s+\w+\s*=\s*await\s+/g, feature: 'top-level-await' },
      { pattern: /class\s+\w+\s*{[^}]*\w+\s*=/s, feature: 'class-properties' },
      { pattern: /#\w+\s*\(/g, feature: 'private-methods' },
      { pattern: /@\w+/g, feature: 'decorators' },
      { pattern: /\|>/g, feature: 'pipeline-operator' }
    ];

    for (const { pattern, feature } of patterns) {
      if (pattern.test(code)) {
        const languageFeature = this.modernJSFeatures.get(feature);
        if (languageFeature && !features.includes(languageFeature)) {
          features.push(languageFeature);
        }
      }
    }

    return features;
  }

  private detectTypeScriptFeaturesWithPatterns(code: string): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    
    const patterns = [
      { pattern: /interface\s+\w+/g, feature: 'typescript-interfaces' },
      { pattern: /enum\s+\w+\s*{/g, feature: 'typescript-enums' },
      { pattern: /<[A-Z]\w*>/g, feature: 'typescript-generics' },
      { pattern: /@\w+/g, feature: 'typescript-decorators' },
      { pattern: /namespace\s+\w+/g, feature: 'typescript-namespaces' },
      { pattern: /\w+\s+as\s+\w+/g, feature: 'typescript-type-assertions' },
      { pattern: /declare\s+/g, feature: 'typescript-ambient-declarations' }
    ];

    for (const { pattern, feature } of patterns) {
      if (pattern.test(code)) {
        const languageFeature = this.typescriptFeatures.get(feature);
        if (languageFeature && !features.includes(languageFeature)) {
          features.push(languageFeature);
        }
      }
    }

    return features;
  }

  private detectFrameworkFeaturesWithPatterns(code: string, framework: SupportedFramework): LanguageFeature[] {
    const features: LanguageFeature[] = [];
    const frameworkFeatureMap = this.frameworkFeatures.get(framework);
    
    if (!frameworkFeatureMap) return features;
    
    // Framework-specific pattern detection
    if (framework === 'react') {
      if (/<[A-Z]\w*/.test(code)) {
        const feature = frameworkFeatureMap.get('jsx-elements');
        if (feature) features.push(feature);
      }
      if (/<>.*<\/>/s.test(code)) {
        const feature = frameworkFeatureMap.get('jsx-fragments');
        if (feature) features.push(feature);
      }
      if (/use[A-Z]\w*\s*\(/.test(code)) {
        const feature = frameworkFeatureMap.get('react-hooks');
        if (feature) features.push(feature);
      }
    }
    
    if (framework === 'solid') {
      if (/<[A-Z]\w*/.test(code)) {
        const feature = frameworkFeatureMap.get('solid-jsx');
        if (feature) features.push(feature);
      }
      if (/create(Signal|Effect|Memo|Resource)\s*\(/.test(code)) {
        const feature = frameworkFeatureMap.get('solid-reactivity');
        if (feature) features.push(feature);
      }
    }
    
    if (framework === 'vue') {
      if (/defineComponent\s*\(/.test(code)) {
        const feature = frameworkFeatureMap.get('vue-sfc');
        if (feature) features.push(feature);
      }
      if (/(ref|reactive|computed|watch|onMounted)\s*\(/.test(code)) {
        const feature = frameworkFeatureMap.get('vue-composition-api');
        if (feature) features.push(feature);
      }
    }
    
    return features;
  }
}