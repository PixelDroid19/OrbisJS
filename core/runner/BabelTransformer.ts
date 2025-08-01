/**
 * BabelTransformer - Handles JavaScript/TypeScript transformation using Babel
 * Uses WebContainer's package system instead of CDN loading
 */

import type { WebContainer } from '@webcontainer/api';
import type { PackageManager } from './PackageManager.js';

/**
 * Configuration for Babel transformation
 */
export interface BabelConfig {
  presets?: string[];
  plugins?: string[];
  filename?: string;
  sourceType?: 'module' | 'script';
  compact?: boolean;
  comments?: boolean;
}

/**
 * Manager for Babel transformations
 */
export class BabelTransformer {
  private static instance: BabelTransformer;
  private webContainer: WebContainer | null = null;
  private packageManager: PackageManager | null = null;
  private isInitialized = false;
  private fallbackTransformer: ((code: string) => string) | null = null;

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
   * Initialize Babel transformer with WebContainer and PackageManager
   */
  public async initialize(webContainer?: WebContainer, packageManager?: PackageManager): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Store references for later use
    if (webContainer) {
      this.webContainer = webContainer;
    }
    if (packageManager) {
      this.packageManager = packageManager;
    }

    // Initialize fallback transformer immediately
    this.initializeFallback();
    this.isInitialized = true;
    console.log('✅ BabelTransformer initialized with fallback');
  }

  /**
   * Check if Babel is already installed in WebContainer (without installing it)
   */
  private async isBabelInstalled(): Promise<boolean> {
    if (!this.packageManager) {
      return false;
    }

    try {
      const installedPackages = await this.packageManager.getInstalledPackages();
      return installedPackages.some(pkg => pkg.name === '@babel/standalone');
    } catch (error) {
      console.warn('⚠️ Error checking installed packages:', error);
      return false;
    }
  }

  /**
   * Transform code using Babel in WebContainer (only if already installed)
   */
  private async transformWithBabel(code: string, config: BabelConfig): Promise<string> {
    if (!this.webContainer) {
      throw new Error('WebContainer not available');
    }

    // Check if Babel is already installed (don't install automatically)
    const babelAvailable = await this.isBabelInstalled();
    if (!babelAvailable) {
      throw new Error('Babel not available - install @babel/standalone manually if needed');
    }

    // Create a temporary transformation script
    const transformScript = `
const babel = require('@babel/standalone');

const code = ${JSON.stringify(code)};
const options = ${JSON.stringify(config)};

try {
  const result = babel.transform(code, options);
  console.log(JSON.stringify({ success: true, code: result.code }));
} catch (error) {
  console.log(JSON.stringify({ success: false, error: error.message }));
}
`;

    try {
      // Write the transformation script
      await this.webContainer.fs.writeFile('/transform.js', transformScript);

      // Execute the transformation
      const process = await this.webContainer.spawn('node', ['/transform.js']);
      
      let output = '';
      process.output.pipeTo(new WritableStream({
        write(data) {
          output += data;
        }
      }));

      const exitCode = await process.exit;
      
      if (exitCode === 0) {
        try {
          const result = JSON.parse(output.trim());
          if (result.success) {
            return result.code;
          } else {
            throw new Error(result.error);
          }
        } catch (parseError) {
          throw new Error('Failed to parse transformation result');
        }
      } else {
        throw new Error(`Transformation process failed with exit code ${exitCode}`);
      }
    } finally {
      // Clean up the temporary file
      try {
        await this.webContainer.fs.unlink('/transform.js');
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }



  /**
   * Initialize fallback transformer (simple pass-through)
   */
  private initializeFallback(): void {
    console.log('🔄 Inicializando transformador fallback...');
    
    this.fallbackTransformer = (code: string) => {
      console.log('⚠️ Usando transformador simple (sin Babel)');
      return code;
    };

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
  public async transformJavaScript(code: string, config: Partial<BabelConfig> = {}): Promise<string> {
    if (!this.isInitialized) {
      console.warn('⚠️ Babel no inicializado, devolviendo código sin transformar');
      return code;
    }

    const babelConfig: BabelConfig = {
      presets: config.presets || ['env'],
      plugins: config.plugins || [],
      filename: config.filename || 'script.js',
      compact: false
    };

    // Only try Babel if it's already installed, don't install automatically
    try {
      if (this.webContainer && this.packageManager) {
        const babelAvailable = await this.isBabelInstalled();
        if (babelAvailable) {
          return await this.transformWithBabel(code, babelConfig);
        } else {
          console.log('ℹ️ @babel/standalone not installed. Install it manually if you need advanced transformations.');
        }
      }
    } catch (error) {
      console.warn('⚠️ Error en transformación JavaScript con Babel:', error);
    }

    // Fallback to simple transformation
    console.log('🔄 Usando transformación simple como fallback');
    return this.simpleModernJSTransform(code);
  }

  /**
   * Transform TypeScript code to JavaScript
   */
  public async transformTypeScript(code: string, config: Partial<BabelConfig> = {}): Promise<string> {
    if (!this.isInitialized) {
      console.warn('⚠️ Babel no inicializado, usando transformación simple de TypeScript');
      return this.simpleTypeScriptTransform(code);
    }

    const babelConfig: BabelConfig = {
      presets: ['typescript', ...(config.presets || ['env'])],
      plugins: config.plugins || [],
      filename: config.filename || 'script.ts',
      compact: false
    };

    // Only try Babel if it's already installed, don't install automatically
    try {
      if (this.webContainer && this.packageManager) {
        const babelAvailable = await this.isBabelInstalled();
        if (babelAvailable) {
          return await this.transformWithBabel(code, babelConfig);
        } else {
          console.log('ℹ️ @babel/standalone not installed. Install it manually if you need advanced TypeScript transformations.');
        }
      }
    } catch (error) {
      console.warn('⚠️ Error en transformación TypeScript con Babel:', error);
    }

    // Fallback to simple transformation
    console.log('🔄 Usando transformación simple de TypeScript como fallback');
    return this.simpleTypeScriptTransform(code);
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
  public async transformCode(code: string, language: 'javascript' | 'typescript' = 'javascript'): Promise<string> {
    if (language === 'typescript' || this.isTypeScript(code)) {
      return await this.transformTypeScript(code);
    }
    
    return await this.transformJavaScript(code);
  }

  /**
   * Get available presets and plugins
   */
  public getAvailableOptions(): { presets: string[]; plugins: string[] } {
    // Return basic options since we're using WebContainer-based Babel
    return {
      presets: ['env', 'typescript', 'react'],
      plugins: ['transform-react-jsx', 'transform-object-rest-spread', 'transform-async-to-generator']
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