/**
 * WebContainerRunner - Main execution engine for safe code execution
 * Integrates WebContainer, FileSystem, Process, and Babel components
 */

import { WebContainerManager } from './WebContainerManager.js';
import { FileSystemManager } from './FileSystemManager.js';
import { ProcessManager } from './ProcessManager.js';
import { BabelTransformer } from './BabelTransformer.js';
import type { 
  ExecutionResult, 
  SupportedLanguage,
  LanguageConfig,
  RunnerConfig 
} from './types.js';

/**
 * Language configurations
 */
const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
  javascript: {
    extension: 'js',
    command: 'node',
    args: ['--experimental-modules', '--no-warnings']
  },
  typescript: {
    extension: 'ts',
    command: 'node',
    args: ['--loader', 'ts-node/esm', '--experimental-specifier-resolution=node']
  },
  python: {
    extension: 'py',
    command: 'python',
    args: []
  },
  shell: {
    extension: 'sh',
    command: 'sh',
    args: []
  }
};

/**
 * Main WebContainerRunner class
 * Provides a unified interface for safe code execution
 */
export class WebContainerRunner {
  private containerManager: WebContainerManager;
  private fileSystemManager: FileSystemManager | null = null;
  private processManager: ProcessManager | null = null;
  private babelTransformer: BabelTransformer;
  private isInitialized = false;
  private config: RunnerConfig;

  constructor(config: RunnerConfig = {}) {
    this.config = {
      timeout: 30000,
      maxOutputSize: 100000,
      workingDirectory: '/',
      enableStderr: true,
      ...config
    };

    this.containerManager = WebContainerManager.getInstance();
    this.babelTransformer = BabelTransformer.getInstance();
  }

  /**
   * Initialize the runner
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize WebContainer
      const container = await this.containerManager.initialize();

      // Initialize managers
      this.fileSystemManager = new FileSystemManager(container);
      this.processManager = new ProcessManager(container, this.config);

      // Initialize Babel
      await this.babelTransformer.initialize();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize runner: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if runner is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && 
           this.fileSystemManager !== null && 
           this.processManager !== null;
  }

  /**
   * Run code with specified language
   */
  public async runCode(
    code: string, 
    language: SupportedLanguage = 'javascript',
    options: { filename?: string; transform?: boolean } = {}
  ): Promise<ExecutionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    const filename = options.filename || `main.${LANGUAGE_CONFIGS[language].extension}`;

    try {
      console.log(`🚀 Ejecutando código ${language}...`);
      
      // Prepare code
      let processedCode = code;
      
      if (options.transform !== false && language === 'javascript') {
        try {
          processedCode = this.babelTransformer.transformCode(code);
        } catch (transformError) {
          console.warn('⚠️ Error en transformación Babel, usando código original:', transformError);
          processedCode = code;
        }
      } else if (language === 'typescript') {
        try {
          processedCode = this.babelTransformer.transformTypeScript(code);
        } catch (transformError) {
          console.warn('⚠️ Error en transformación TypeScript, usando código original:', transformError);
          processedCode = code;
        }
      }

      // Create project structure
      const projectTree = this.fileSystemManager!.getSimpleProjectTree(
        'user-project',
        filename,
        processedCode,
        language === 'javascript'
      );

      // Mount files
      console.log('📁 Montando archivos...');
      await this.fileSystemManager!.mountFiles(projectTree);

      // Install dependencies if needed (but don't wait too long)
      if (this.hasDependencies(code)) {
        console.log('📦 Instalando dependencias...');
        try {
          const installResult = await Promise.race([
            this.installDependencies(code),
            new Promise<ExecutionResult>((_, reject) => 
              setTimeout(() => reject(new Error('Dependency installation timeout')), 15000)
            )
          ]);
          
          if (!installResult.success) {
            console.warn('⚠️ Instalación de dependencias falló, continuando sin ellas');
          }
        } catch (installError) {
          console.warn('⚠️ Error instalando dependencias:', installError);
          // Continue without dependencies
        }
      }

      // Execute based on language
      console.log('⚡ Ejecutando código...');
      let result: ExecutionResult;

      switch (language) {
        case 'javascript':
        case 'typescript':
          result = await this.processManager!.execute(
            LANGUAGE_CONFIGS[language].command,
            [filename],
            { cwd: '/' }
          );
          break;
        
        case 'python':
          result = await this.processManager!.execute('python', [filename]);
          break;
        
        case 'shell':
          result = await this.processManager!.execute('sh', ['-c', code]);
          break;
        
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      console.log(`✅ Ejecución completada en ${result.duration}ms`);
      return result;

    } catch (error) {
      console.error('❌ Error en ejecución:', error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Run npm commands
   */
  public async runNpmCommand(command: string, args: string[] = []): Promise<ExecutionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    return this.processManager!.execute('npm', [command, ...args]);
  }

  /**
   * Install dependencies from package.json
   */
  public async installDependencies(code?: string): Promise<ExecutionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    // Create package.json if dependencies detected
    if (code) {
      const deps = this.extractDependencies(code);
      if (deps.length > 0) {
        await this.fileSystemManager!.createPackageJson({
          name: 'user-project',
          dependencies: deps.reduce((acc, dep) => ({ ...acc, [dep]: 'latest' }), {})
        });
      }
    }

    return this.processManager!.execute('npm', ['install']);
  }

  /**
   * Check if code has dependencies
   */
  private hasDependencies(code: string): boolean {
    const importPatterns = [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    return importPatterns.some(pattern => pattern.test(code));
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string): string[] {
    const deps: string[] = [];
    const importPatterns = [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const dep = match[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          deps.push(dep);
        }
      }
    }

    return [...new Set(deps)];
  }

  /**
   * Create a simple web project
   */
  public async createWebProject(
    html: string, 
    js: string, 
    css: string = ''
  ): Promise<ExecutionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    const projectTree = {
      'package.json': {
        file: {
          contents: JSON.stringify({
            name: 'web-project',
            version: '1.0.0',
            type: 'module',
            scripts: {
              start: 'npx serve .',
              dev: 'npx serve . --cors'
            }
          }, null, 2)
        }
      },
      'index.html': {
        file: {
          contents: html
        }
      },
      'index.js': {
        file: {
          contents: this.babelTransformer.transformCode(js)
        }
      },
      ...(css && {
        'styles.css': {
          file: {
            contents: css
          }
        }
      })
    };

    await this.fileSystemManager!.mountFiles(projectTree);
    await this.installDependencies();

    return this.processManager!.execute('npx', ['serve', '.', '--port', '3000']);
  }

  /**
   * Get current status
   */
  public getStatus() {
    return {
      isInitialized: this.isInitialized,
      container: this.containerManager.getBootStats(),
      process: this.processManager?.getProcessStatus() || 'idle'
    };
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this.containerManager.forceCleanup();
    this.isInitialized = false;
    this.fileSystemManager = null;
    this.processManager = null;
  }

  /**
   * Reset runner state
   */
  public async reset(): Promise<void> {
    await this.cleanup();
    await this.initialize();
  }
}