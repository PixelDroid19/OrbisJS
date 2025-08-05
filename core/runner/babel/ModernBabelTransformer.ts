/**
 * ModernBabelTransformer - Enhanced Babel transformation system
 * Replaces CDN-based Babel loading with npm-based @babel/core integration
 */

import type {
  TransformOptions,
  TransformResult,
  BabelGlobalConfig,
  JavaScriptConfig,
  TypeScriptConfig,
  SupportedLanguage,
  SupportedFramework,
  PresetInfo,
  PluginInfo,
  CacheStats,
  ValidationResult,
  PerformanceMetrics,
  TransformMetadata,
  TransformationError,
  SourceMap
} from './types.js';
import { ErrorHandler, type ErrorContext } from './ErrorHandler.js';
import type { WebContainerInstance } from '../types.js';

/**
 * Core interface for the modern Babel transformer
 */
export interface IModernBabelTransformer {
  // Core transformation methods
  transformCode(code: string, options?: TransformOptions): Promise<TransformResult>;
  transformFile(filePath: string, options?: TransformOptions): Promise<TransformResult>;
  
  // Language-specific transformations
  transformJavaScript(code: string, config?: JavaScriptConfig): Promise<TransformResult>;
  transformTypeScript(code: string, config?: TypeScriptConfig): Promise<TransformResult>;
  transformJSX(code: string, framework: SupportedFramework): Promise<TransformResult>;
  
  // Configuration management
  setGlobalConfig(config: BabelGlobalConfig): void;
  getActiveConfig(): BabelGlobalConfig;
  validateConfig(config: BabelGlobalConfig): ValidationResult;
  
  // Plugin and preset management
  registerPreset(name: string, preset: any): void;
  registerPlugin(name: string, plugin: any): void;
  getAvailablePresets(): PresetInfo[];
  getAvailablePlugins(): PluginInfo[];
  
  // Performance and caching
  clearCache(): void;
  getCacheStats(): CacheStats;
  enableSourceMaps(enabled: boolean): void;
  
  // Initialization and lifecycle
  initialize(): Promise<void>;
  isInitialized(): boolean;
  destroy(): void;
}

/**
 * Modern Babel Transformer implementation
 * Uses npm-based @babel/core for programmatic transformation
 */
export class ModernBabelTransformer implements IModernBabelTransformer {
  private static instance: ModernBabelTransformer | null = null;
  private initialized = false;
  private babel: any = null;
  private globalConfig: BabelGlobalConfig;
  private transformCache = new Map<string, any>();
  private sourceMapsEnabled = true;
  private registeredPresets = new Map<string, any>();
  private registeredPlugins = new Map<string, any>();
  private errorHandler: ErrorHandler | null = null;

  private constructor() {
    this.globalConfig = this.createDefaultConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ModernBabelTransformer {
    if (!ModernBabelTransformer.instance) {
      ModernBabelTransformer.instance = new ModernBabelTransformer();
    }
    return ModernBabelTransformer.instance;
  }

  /**
   * Set WebContainer instance for error handling
   */
  public setWebContainer(container: WebContainerInstance): void {
    this.errorHandler = new ErrorHandler(container);
  }

  /**
   * Initialize the Babel transformer with npm-based @babel/core
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔄 Initializing Modern Babel Transformer...');
      
      // Import @babel/core dynamically
      this.babel = await this.loadBabelCore();
      
      // Verify Babel is working with a simple test
      await this.verifyBabelFunctionality();
      
      // Initialize default presets and plugins
      await this.initializeDefaultPresets();
      
      this.initialized = true;
      console.log('✅ Modern Babel Transformer initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Modern Babel Transformer:', error);
      
      // Use error handler if available for initialization errors
      if (this.errorHandler) {
        const context: ErrorContext = {
          code: '',
          config: this.globalConfig,
          phase: 'validation'
        };

        const { error: detailedError } = await this.errorHandler.handleTransformationError(
          error as Error,
          context
        );

        const userFriendlyMessage = this.errorHandler.formatErrorForUser(detailedError);
        console.error('❌ Initialization failed:\n', userFriendlyMessage);
      }
      
      throw new TransformationError(
        (error as Error).message || 'Failed to initialize Babel transformer',
        'configuration',
        '',
        0,
        0,
        undefined,
        error,
        [{
          type: 'dependency',
          description: 'Ensure @babel/core and required presets are installed',
          action: 'npm install @babel/core @babel/preset-env @babel/preset-typescript',
          autoApplicable: false
        }]
      );
    }
  }

  /**
   * Load @babel/core dynamically
   */
  private async loadBabelCore(): Promise<any> {
    try {
      // Try to import @babel/core
      const babelCore = await import('@babel/core');
      return babelCore;
    } catch (error) {
      console.error('Failed to load @babel/core:', error);
      throw new Error('@babel/core is not available. Please ensure it is installed.');
    }
  }

  /**
   * Verify Babel functionality with a simple test
   */
  private async verifyBabelFunctionality(): Promise<void> {
    try {
      const testCode = 'const x = 1;';
      const result = await this.babel.transformAsync(testCode, {
        presets: [['@babel/preset-env', { targets: { node: '18' } }]]
      });
      
      if (!result || !result.code) {
        throw new Error('Babel transform test failed - no output');
      }
      
      console.log('✅ Babel functionality verified');
    } catch (error) {
      console.error('Babel functionality test failed:', error);
      throw error;
    }
  }

  /**
   * Initialize default presets and plugins
   */
  private async initializeDefaultPresets(): Promise<void> {
    try {
      // Register common presets
      const presets = [
        '@babel/preset-env',
        '@babel/preset-typescript',
        '@babel/preset-react'
      ];

      for (const preset of presets) {
        try {
          const presetModule = await import(preset);
          this.registeredPresets.set(preset, presetModule.default || presetModule);
        } catch (error) {
          console.warn(`⚠️ Failed to load preset ${preset}:`, error);
        }
      }

      // Register common plugins
      const plugins = [
        '@babel/plugin-transform-runtime',
        '@babel/plugin-proposal-class-properties',
        '@babel/plugin-transform-optional-chaining',
        '@babel/plugin-transform-nullish-coalescing-operator'
      ];

      for (const plugin of plugins) {
        try {
          const pluginModule = await import(plugin);
          this.registeredPlugins.set(plugin, pluginModule.default || pluginModule);
        } catch (error) {
          console.warn(`⚠️ Failed to load plugin ${plugin}:`, error);
        }
      }

      console.log(`✅ Initialized ${this.registeredPresets.size} presets and ${this.registeredPlugins.size} plugins`);
    } catch (error) {
      console.error('Failed to initialize default presets:', error);
      throw error;
    }
  }

  /**
   * Create default Babel configuration
   */
  private createDefaultConfig(): BabelGlobalConfig {
    return {
      presets: [
        {
          name: '@babel/preset-env',
          options: {
            targets: { node: '18' },
            modules: 'auto'
          },
          enabled: true,
          order: 0
        }
      ],
      plugins: [],
      targets: {
        node: '18',
        esmodules: true
      },
      sourceType: 'unambiguous',
      assumptions: {},
      parserOpts: {
        strictMode: true,
        allowImportExportEverywhere: false,
        allowReturnOutsideFunction: false,
        ranges: false,
        tokens: false,
        plugins: []
      },
      generatorOpts: {
        compact: false,
        minified: false,
        sourceMaps: true,
        retainLines: false
      },
      env: {}
    };
  }

  /**
   * Transform code with comprehensive error handling and caching
   */
  public async transformCode(code: string, options: TransformOptions = {}): Promise<TransformResult> {
    if (!this.initialized || !this.babel) {
      throw new TransformationError(
        'Babel transformer not initialized',
        'configuration',
        code,
        0,
        0,
        options.filename,
        undefined,
        [{
          type: 'config',
          description: 'Initialize the transformer before use',
          action: 'Call initialize() method',
          autoApplicable: false
        }]
      );
    }

    const startTime = performance.now();
    const cacheKey = this.generateCacheKey(code, options);
    
    // Check cache first
    if (this.transformCache.has(cacheKey)) {
      const cached = this.transformCache.get(cacheKey);
      if (cached && cached.performance) {
        cached.performance.cacheHit = true;
      }
      return cached;
    }

    try {
      // Build Babel options from global config and transform options
      const babelOptions = this.buildBabelOptions(options);
      
      // Perform transformation
      const result = await this.babel.transformAsync(code, babelOptions);
      
      if (!result || !result.code) {
        throw new Error('Babel transformation returned no result');
      }

      const endTime = performance.now();
      const transformTime = endTime - startTime;

      // Build transform result
      const transformResult: TransformResult = {
        code: result.code,
        map: result.map as SourceMap,
        ast: result.ast,
        metadata: this.buildTransformMetadata(code, result.code, babelOptions, []),
        performance: {
          transformTime,
          cacheHit: false,
          memoryUsage: this.estimateMemoryUsage(code, result.code)
        }
      };

      // Cache the result
      this.transformCache.set(cacheKey, transformResult);
      
      return transformResult;

    } catch (error) {
      // Use comprehensive error handler if available
      if (this.errorHandler) {
        const context: ErrorContext = {
          code,
          filename: options.filename,
          config: this.globalConfig,
          line: (error as any).loc?.line,
          column: (error as any).loc?.column,
          phase: 'transformation'
        };

        const { error: detailedError, resolution } = await this.errorHandler.handleTransformationError(
          error as Error,
          context
        );

        // If we have a fallback resolution, use it
        if (resolution) {
          console.warn('⚠️ Using fallback transformation due to error:', detailedError.message);
          console.warn('📝 Fallback warnings:', resolution.warnings);
          
          return {
            code: resolution.code,
            map: undefined,
            ast: undefined,
            metadata: {
              originalSize: code.length,
              transformedSize: resolution.code.length,
              appliedPresets: [],
              appliedPlugins: [],
              warnings: resolution.warnings,
              dependencies: []
            },
            performance: {
              transformTime: 0,
              executionTime: 0,
              totalTime: 0,
              memoryUsage: 0,
              cacheHit: false
            }
          };
        }

        // Format error for user and throw
        const userFriendlyMessage = this.errorHandler.formatErrorForUser(detailedError);
        console.error('❌ Babel transformation failed:\n', userFriendlyMessage);
        
        // Create enhanced transformation error
        const enhancedError = new TransformationError(
          detailedError.message,
          detailedError.type as any,
          code,
          detailedError.location?.line,
          detailedError.location?.column,
          options.filename,
          error,
          detailedError.suggestions
        );
        
        throw enhancedError;
      } else {
        // Fallback to basic error handling
        const transformError = this.createTransformationError(error, code, options);
        console.error('❌ Babel transformation failed:', transformError);
        throw transformError;
      }
    }
  }

  /**
   * Transform file by reading content and applying transformation
   */
  public async transformFile(filePath: string, options: TransformOptions = {}): Promise<TransformResult> {
    // This would typically read from file system
    // For now, we'll throw an error indicating this needs WebContainer integration
    throw new Error('transformFile requires WebContainer integration - use transformCode instead');
  }

  /**
   * Transform JavaScript code with specific configuration
   */
  public async transformJavaScript(code: string, config: JavaScriptConfig = {}): Promise<TransformResult> {
    const options: TransformOptions = {
      language: 'javascript',
      customConfig: {
        presets: [{
          name: '@babel/preset-env',
          options: {
            targets: config.targets || this.globalConfig.targets,
            modules: config.modules || 'auto',
            loose: config.loose || false,
            spec: config.spec || false,
            debug: config.debug || false
          },
          enabled: true,
          order: 0
        }],
        plugins: this.globalConfig.plugins
      }
    };

    return this.transformCode(code, options);
  }

  /**
   * Transform TypeScript code with specific configuration
   */
  public async transformTypeScript(code: string, config: TypeScriptConfig = {}): Promise<TransformResult> {
    const options: TransformOptions = {
      language: 'typescript',
      customConfig: {
        presets: [
          {
            name: '@babel/preset-typescript',
            options: {
              allowNamespaces: config.allowNamespaces || false,
              allowDeclareFields: config.allowDeclareFields || false,
              disallowAmbiguousJSXLike: config.disallowAmbiguousJSXLike || false,
              isTSX: config.isTSX || false,
              jsxPragma: config.jsxPragma,
              jsxPragmaFrag: config.jsxPragmaFrag,
              onlyRemoveTypeImports: config.onlyRemoveTypeImports || false,
              optimizeConstEnums: config.optimizeConstEnums || false
            },
            enabled: true,
            order: 0
          },
          {
            name: '@babel/preset-env',
            options: {
              targets: this.globalConfig.targets,
              modules: 'auto'
            },
            enabled: true,
            order: 1
          }
        ],
        plugins: this.globalConfig.plugins
      }
    };

    return this.transformCode(code, options);
  }

  /**
   * Transform JSX code for specific framework
   */
  public async transformJSX(code: string, framework: SupportedFramework): Promise<TransformResult> {
    const frameworkPresets = this.getFrameworkPresets(framework);
    
    const options: TransformOptions = {
      language: 'jsx',
      framework,
      customConfig: {
        presets: frameworkPresets,
        plugins: this.globalConfig.plugins
      }
    };

    return this.transformCode(code, options);
  }

  /**
   * Get framework-specific presets
   */
  private getFrameworkPresets(framework: SupportedFramework): any[] {
    switch (framework) {
      case 'react':
        return [
          {
            name: '@babel/preset-react',
            options: {
              runtime: 'automatic',
              importSource: 'react'
            },
            enabled: true,
            order: 0
          },
          {
            name: '@babel/preset-env',
            options: {
              targets: this.globalConfig.targets,
              modules: 'auto'
            },
            enabled: true,
            order: 1
          }
        ];
      
      case 'solid':
        return [
          {
            name: 'babel-preset-solid',
            options: {},
            enabled: true,
            order: 0
          }
        ];
      
      case 'vue':
        return [
          {
            name: '@vue/babel-preset-jsx',
            options: {},
            enabled: true,
            order: 0
          }
        ];
      
      default:
        return this.globalConfig.presets;
    }
  }

  /**
   * Build Babel options from transform options
   */
  private buildBabelOptions(options: TransformOptions): any {
    const config = options.customConfig || this.globalConfig;
    
    return {
      presets: config.presets.filter(p => p.enabled).map(p => [p.name, p.options]),
      plugins: config.plugins.filter(p => p.enabled).map(p => [p.name, p.options]),
      filename: options.filename || 'unknown.js',
      sourceMaps: this.sourceMapsEnabled && (options.sourceMaps !== false),
      sourceType: config.sourceType,
      assumptions: config.assumptions,
      parserOpts: config.parserOpts,
      generatorOpts: {
        ...config.generatorOpts,
        minified: options.minify || false
      }
    };
  }

  /**
   * Build transform metadata
   */
  private buildTransformMetadata(
    originalCode: string,
    transformedCode: string,
    babelOptions: any,
    warnings: any[]
  ): TransformMetadata {
    return {
      originalSize: originalCode.length,
      transformedSize: transformedCode.length,
      appliedPresets: babelOptions.presets.map((p: any) => Array.isArray(p) ? p[0] : p),
      appliedPlugins: babelOptions.plugins.map((p: any) => Array.isArray(p) ? p[0] : p),
      warnings: warnings.map(w => ({
        type: 'compatibility' as const,
        message: w.message || 'Unknown warning',
        plugin: w.plugin
      })),
      dependencies: []
    };
  }

  /**
   * Generate cache key for transformation
   */
  private generateCacheKey(code: string, options: TransformOptions): string {
    const optionsStr = JSON.stringify(options);
    const configStr = JSON.stringify(this.globalConfig);
    return `${code.length}-${this.hashString(code + optionsStr + configStr)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(originalCode: string, transformedCode: string): number {
    // Rough estimation: 2 bytes per character (UTF-16) plus overhead
    return (originalCode.length + transformedCode.length) * 2 + 1024;
  }

  /**
   * Create transformation error with context
   */
  private createTransformationError(
    error: any,
    code: string,
    options: TransformOptions
  ): TransformationError {
    return new TransformationError(
      error.message || 'Unknown transformation error',
      'syntax',
      code,
      error.loc?.line,
      error.loc?.column,
      options.filename,
      error,
      [{
        type: 'syntax',
        description: 'Check code syntax and Babel configuration',
        action: 'Review the error message and fix syntax issues',
        autoApplicable: false
      }]
    );
  }

  // Configuration management methods
  public setGlobalConfig(config: BabelGlobalConfig): void {
    this.globalConfig = config;
    this.clearCache(); // Clear cache when config changes
  }

  public getActiveConfig(): BabelGlobalConfig {
    return { ...this.globalConfig };
  }

  public validateConfig(config: BabelGlobalConfig): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Basic validation
    if (!config.presets || !Array.isArray(config.presets)) {
      errors.push({
        field: 'presets',
        message: 'Presets must be an array',
        value: config.presets
      });
    }

    if (!config.plugins || !Array.isArray(config.plugins)) {
      errors.push({
        field: 'plugins',
        message: 'Plugins must be an array',
        value: config.plugins
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Plugin and preset management
  public registerPreset(name: string, preset: any): void {
    this.registeredPresets.set(name, preset);
  }

  public registerPlugin(name: string, plugin: any): void {
    this.registeredPlugins.set(name, plugin);
  }

  public getAvailablePresets(): PresetInfo[] {
    return Array.from(this.registeredPresets.entries()).map(([name, preset]) => ({
      name,
      version: '1.0.0', // Would be extracted from package.json in real implementation
      description: `Babel preset: ${name}`,
      options: {},
      dependencies: [],
      frameworks: []
    }));
  }

  public getAvailablePlugins(): PluginInfo[] {
    return Array.from(this.registeredPlugins.entries()).map(([name, plugin]) => ({
      name,
      version: '1.0.0', // Would be extracted from package.json in real implementation
      description: `Babel plugin: ${name}`,
      options: {},
      dependencies: [],
      stage: 0
    }));
  }

  // Performance and caching
  public clearCache(): void {
    this.transformCache.clear();
    console.log('🧹 Babel transformation cache cleared');
  }

  public getCacheStats(): CacheStats {
    const entries = Array.from(this.transformCache.values());
    const totalSize = entries.reduce((sum, entry) => sum + (entry.metadata?.originalSize || 0), 0);
    
    return {
      totalEntries: this.transformCache.size,
      totalSize,
      hitRate: 0, // Would be calculated based on hit/miss tracking
      missRate: 0,
      averageTransformTime: 0, // Would be calculated from performance metrics
      cacheEfficiency: 0
    };
  }

  public enableSourceMaps(enabled: boolean): void {
    this.sourceMapsEnabled = enabled;
  }

  // Lifecycle methods
  public isInitialized(): boolean {
    return this.initialized;
  }

  public destroy(): void {
    this.clearCache();
    this.registeredPresets.clear();
    this.registeredPlugins.clear();
    this.initialized = false;
    this.babel = null;
    console.log('🗑️ Modern Babel Transformer destroyed');
  }
}

// Custom error class for transformation errors
class TransformationError extends Error implements TransformationError {
  constructor(
    message: string,
    public type: 'syntax' | 'plugin' | 'preset' | 'configuration',
    public code: string,
    public line?: number,
    public column?: number,
    public filename?: string,
    public babelError?: any,
    public suggestions: unknown[] = []
  ) {
    super(message);
    this.name = 'TransformationError';
  }
}

// Export singleton instance
export const modernBabelTransformer = ModernBabelTransformer.getInstance();