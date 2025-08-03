/**
 * BabelTransformer - JavaScript/TypeScript compilation using Babel standalone
 */

import type { BabelConfig } from './types.js';

// Babel interface definition
interface BabelGlobal {
  transform: (code: string, options: BabelTransformOptions) => { code?: string };
  availablePresets: string[];
  availablePlugins: string[];
}

// Extend global window interface for Babel
declare global {
  interface Window {
    Babel?: BabelGlobal;
  }
}

interface WindowWithBabel extends Window {
  Babel?: BabelGlobal;
}

// Babel standalone will be loaded dynamically
interface BabelTransformOptions {
  presets?: string[];
  plugins?: string[];
  filename?: string;
  sourceMaps?: boolean;
  compact?: boolean;
}

interface BabelTransformResult {
  code: string;
  map?: unknown;
}

interface BabelStandalone {
  transform(code: string, options: BabelTransformOptions): BabelTransformResult;
  availablePresets: string[];
  availablePlugins: string[];
}

let babel: BabelStandalone | null = null;

/**
 * Manager for Babel transformations
 */
export class BabelTransformer {
  private static instance: BabelTransformer;
  private isInitialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): BabelTransformer {
    if (!BabelTransformer.instance) {
      BabelTransformer.instance = new BabelTransformer();
    }
    return BabelTransformer.instance;
  }

  /**
   * Initialize Babel standalone
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🔄 Inicializando Babel transformer...');
      
      // Try to load Babel standalone with timeout
      await this.loadBabelWithTimeout();
      
      // @ts-expect-error - Babel is loaded globally
      babel = window.Babel;
      
      if (!babel) {
        throw new Error('Babel standalone not available after loading');
      }

      // Verify Babel is working
      try {
        const testResult = babel.transform('const x = 1;', { presets: ['env'] });
        if (!testResult || !testResult.code) {
          throw new Error('Babel transform test failed');
        }
      } catch (testError) {
        console.warn('Babel test failed:', testError);
        throw new Error('Babel functionality test failed');
      }

      this.isInitialized = true;
      console.log('✅ Babel transformer inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando Babel:', error);
      
      // Try fallback: simple pass-through transformer
      console.log('🔄 Usando transformador simple como fallback...');
      this.initializeFallback();
    }
  }

  /**
   * Load Babel with timeout and retry logic
   */
  private async loadBabelWithTimeout(): Promise<void> {
    const CDN_URLS = [
      'https://unpkg.com/@babel/standalone/babel.min.js',
      'https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.0/babel.min.js'
    ];

    for (const url of CDN_URLS) {
      try {
        console.log(`🔄 Intentando cargar Babel desde: ${url}`);
        await this.loadScriptWithTimeout(url, 10000); // 10 second timeout
        
        // Check if Babel was loaded
        if ((window as WindowWithBabel).Babel) {
          console.log('✅ Babel cargado exitosamente desde CDN');
          return;
        }
      } catch (error) {
        console.warn(`❌ Falló carga desde ${url}:`, error);
        continue;
      }
    }

    throw new Error('Failed to load Babel from any CDN');
  }

  /**
   * Load script with timeout
   */
  private async loadScriptWithTimeout(src: string, timeout: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      
      const timeoutId = setTimeout(() => {
        script.remove();
        reject(new Error(`Script load timeout: ${src}`));
      }, timeout);

      script.onload = () => {
        clearTimeout(timeoutId);
        resolve();
      };

      script.onerror = () => {
        clearTimeout(timeoutId);
        script.remove();
        reject(new Error(`Script load error: ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Initialize fallback transformer (simple pass-through)
   */
  private initializeFallback(): void {
    console.log('🔄 Inicializando transformador fallback...');
    
    // Create a minimal Babel-like interface
    babel = {
      transform: (code: string, options: BabelTransformOptions) => {
        console.log('⚠️ Usando transformador simple (sin Babel)');
        
        // Simple transformations for common cases
        let transformedCode = code;
        
        // Basic TypeScript to JavaScript (remove type annotations)
        if (options.presets?.includes('typescript')) {
          transformedCode = this.simpleTypeScriptTransform(transformedCode);
        }
        
        // Basic modern JS transformations
        if (options.presets?.includes('env')) {
          transformedCode = this.simpleModernJSTransform(transformedCode);
        }
        
        return { code: transformedCode };
      },
      availablePresets: ['env', 'typescript', 'react'],
      availablePlugins: []
    };

    this.isInitialized = true;
    console.log('✅ Transformador fallback inicializado');
  }

  /**
   * Simple TypeScript to JavaScript transformation
   */
  private simpleTypeScriptTransform(code: string): string {
    return code
      // Remove type annotations
      .replace(/:\s*[a-zA-Z_$][a-zA-Z0-9_$]*(\[\])?/g, '')
      // Remove interface declarations
      .replace(/interface\s+[^{]+\{[^}]*\}/g, '')
      // Remove type declarations
      .replace(/type\s+[^=]+=\s*[^;]+;/g, '')
      // Remove as type assertions
      .replace(/\s+as\s+[a-zA-Z_$][a-zA-Z0-9_$]*/g, '')
      // Remove import type
      .replace(/import\s+type\s+/g, 'import ')
      // Remove export type
      .replace(/export\s+type\s+/g, 'export ');
  }

  /**
   * Simple modern JavaScript transformations
   */
  private simpleModernJSTransform(code: string): string {
    return code
      // Convert const/let to var for older browsers (basic)
      .replace(/\bconst\b/g, 'var')
      .replace(/\blet\b/g, 'var');
  }

  /**
   * Transform JavaScript code
   */
  public transformJavaScript(code: string, config: Partial<BabelConfig> = {}): string {
    if (!this.isInitialized || !babel) {
      console.warn('⚠️ Babel no inicializado, devolviendo código sin transformar');
      return code;
    }

    const options = {
      presets: config.presets || ['env'],
      plugins: config.plugins || [],
      filename: config.filename || 'script.js',
      sourceMaps: false,
      compact: false
    };

    try {
      const result = babel.transform(code, options);
      return result.code || code;
    } catch (error) {
      console.warn('⚠️ Error en transformación JavaScript, devolviendo código original:', error);
      return code; // Return original code instead of throwing
    }
  }

  /**
   * Transform TypeScript code to JavaScript
   */
  public transformTypeScript(code: string, config: Partial<BabelConfig> = {}): string {
    if (!this.isInitialized || !babel) {
      console.warn('⚠️ Babel no inicializado, usando transformación simple de TypeScript');
      return this.simpleTypeScriptTransform(code);
    }

    const options = {
      presets: ['typescript', ...(config.presets || ['env'])],
      plugins: config.plugins || [],
      filename: config.filename || 'script.ts',
      sourceMaps: false,
      compact: false
    };

    try {
      const result = babel.transform(code, options);
      return result.code || code;
    } catch (error) {
      console.warn('⚠️ Error en transformación TypeScript, usando transformación simple:', error);
      return this.simpleTypeScriptTransform(code);
    }
  }

  /**
   * Check if code is TypeScript
   */
  public isTypeScript(code: string): boolean {
    const tsIndicators = [
      'interface ',
      'type ',
      'declare ',
      ': string',
      ': number',
      ': boolean',
      'as ',
      'import type',
      'export type'
    ];

    return tsIndicators.some(indicator => code.includes(indicator));
  }

  /**
   * Transform code based on language detection
   */
  public transformCode(code: string, language: 'javascript' | 'typescript' = 'javascript'): string {
    if (language === 'typescript' || this.isTypeScript(code)) {
      return this.transformTypeScript(code);
    }
    
    return this.transformJavaScript(code);
  }

  /**
   * Get available presets and plugins
   */
  public getAvailableOptions(): { presets: string[]; plugins: string[] } {
    if (!this.isInitialized || !babel) {
      return { presets: [], plugins: [] };
    }

    return {
      presets: babel.availablePresets || [],
      plugins: babel.availablePlugins || []
    };
  }

  /**
   * Create Babel configuration for React
   */
  public createReactConfig(): BabelConfig {
    return {
      presets: ['react', 'env'],
      plugins: ['transform-react-jsx']
    };
  }

  /**
   * Create Babel configuration for modern JavaScript
   */
  public createModernConfig(): BabelConfig {
    return {
      presets: ['env'],
      plugins: [
        'transform-object-rest-spread',
        'transform-async-to-generator'
      ]
    };
  }
}