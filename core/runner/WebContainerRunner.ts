/**
 * WebContainerRunner - Main execution engine for safe code execution
 * Integrates WebContainer, FileSystem, Process, and Babel components
 */

import { WebContainerManager } from './WebContainerManager.js';
import { FileSystemManager } from './FileSystemManager.js';
import { ProcessManager } from './ProcessManager.js';
import { BabelTransformer } from './BabelTransformer.js';
import { PackageManager } from './PackageManager.js';
import type { 
  ExecutionResult, 
  SupportedLanguage,
  LanguageConfig,
  RunnerConfig 
} from './types.js';
import type { PackageDetectionResult } from './PackageManager.js';

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
  private packageManager: PackageManager | null = null;
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
    this.packageManager = new PackageManager({
      autoInstall: config.autoInstallPackages || false,
      autoDetect: true,
      timeout: config.timeout || 30000,
      maxConcurrentInstalls: 3,
      securityScan: true
    });
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
      
      // Initialize PackageManager
      await this.packageManager!.initialize(container);

      // Initialize Babel with WebContainer and PackageManager references
      await this.babelTransformer.initialize(container, this.packageManager!);

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
           this.processManager !== null &&
           this.packageManager !== null;
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
          processedCode = await this.babelTransformer.transformCode(code);
        } catch (transformError) {
          console.warn('⚠️ Error en transformación Babel, usando código original:', transformError);
          processedCode = code;
        }
      } else if (language === 'typescript') {
        try {
          processedCode = await this.babelTransformer.transformTypeScript(code);
        } catch (transformError) {
          console.warn('⚠️ Error en transformación TypeScript, usando código original:', transformError);
          processedCode = code;
        }
      }

      // Detect dependencies first
      console.log('🔍 Detectando dependencias...');
      let detectedDependencies: Record<string, string> = {};
      try {
        const detection = await this.packageManager!.detectDependencies(code, filename);
        
        // Convert detected packages to dependencies object with latest versions
        for (const packageName of detection.missing) {
          detectedDependencies[packageName] = 'latest';
        }
        
        console.log(`📦 Dependencias detectadas: ${Object.keys(detectedDependencies).join(', ')}`);
      } catch (detectionError) {
        console.warn('⚠️ Error en detección de dependencias:', detectionError);
      }

      // Create project structure without dependencies (clean WebContainer)
      const projectTree = this.fileSystemManager!.getSimpleProjectTree(
        'user-project',
        filename,
        processedCode,
        language === 'javascript'
        // No dependencies passed - WebContainer starts clean
      );

      // Mount files
      console.log('📁 Montando archivos...');
      await this.fileSystemManager!.mountFiles(projectTree);

      // Report detected dependencies but don't install automatically
      if (Object.keys(detectedDependencies).length > 0) {
        console.log(`📦 Dependencias detectadas (no instaladas automáticamente): ${Object.keys(detectedDependencies).join(', ')}`);
        console.log('ℹ️ Use installPackage() para instalar dependencias manualmente si es necesario');
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
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration,
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
   * Install a specific package
   */
  public async installPackage(packageName: string, options?: { dev?: boolean; exact?: boolean; version?: string }): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    console.log(`🚀 WebContainerRunner: Instalando ${packageName}`);
    const result = await this.packageManager!.installPackage(packageName, options);
    console.log(`✅ WebContainerRunner: ${packageName} instalado`);
    return result;
  }

  /**
   * Remove a package
   */
  public async removePackage(packageName: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    console.log(`🗑️ WebContainerRunner: Desinstalando ${packageName}`);
    const result = await this.packageManager!.removePackage(packageName);
    console.log(`✅ WebContainerRunner: ${packageName} desinstalado`);
    return result;
  }

  /**
   * Get installed packages
   */
  public getInstalledPackages() {
    if (!this.isReady()) {
      return [];
    }

    return this.packageManager!.getInstalledPackages();
  }

  /**
   * Get PackageManager instance for editor integration
   */
  public getPackageManager(): PackageManager | null {
    return this.packageManager;
  }

  /**
   * Detect dependencies in code
   */
  public async detectDependencies(code: string, filePath?: string): Promise<PackageDetectionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    return this.packageManager!.detectDependencies(code, filePath);
  }

  /**
   * Auto-install missing dependencies
   */
  public async autoInstallMissing(code: string, filePath?: string): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    return this.packageManager!.autoInstallMissing(code, filePath);
  }

  /**
   * Install dependencies from package.json
   */
  public async installDependencies(code?: string): Promise<ExecutionResult> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    // Use new package manager for dependency detection and installation
    if (code) {
      try {
        const installed = await this.autoInstallMissing(code);
        return {
          success: true,
          output: `Installed ${installed.length} packages: ${installed.join(', ')}`,
          error: '',
          duration: 0,
          timestamp: new Date()
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: new Date()
        };
      }
    }

    return this.processManager!.execute('npm', ['install']);
  }

  /**
   * Check if code has dependencies (deprecated - use PackageManager.detectDependencies)
   * @deprecated Use detectDependencies() instead
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
   * Extract dependencies from code (deprecated - use PackageManager.detectDependencies)
   * @deprecated Use detectDependencies() instead
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
    if (this.packageManager) {
      await this.packageManager.destroy();
      this.packageManager = null;
    }
    
    await this.containerManager.forceCleanup();
    this.isInitialized = false;
    this.fileSystemManager = null;
    this.processManager = null;
  }

  /**
   * Stop current execution
   */
  public async stopExecution(): Promise<void> {
    if (!this.isReady()) {
      return;
    }

    try {
      if (this.processManager) {
        await this.processManager.killCurrentProcess();
        console.log('🛑 Execution stopped');
      }
    } catch (error) {
      console.warn('Error stopping execution:', error);
    }
  }

  /**
   * Reset runner state
   */
  public async reset(): Promise<void> {
    await this.cleanup();
    await this.initialize();
  }

  /**
   * Refresh package list from package.json
   */
  public async refreshPackages(): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Runner not initialized. Call initialize() first.');
    }

    await this.packageManager!.refreshPackages();
  }
}