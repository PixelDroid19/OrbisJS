/**
 * Package Manager - Handles npm package installation, removal, and dependency detection
 * Provides secure and efficient package management for WebContainer environment
 */

import type { WebContainer } from '@webcontainer/api';
import { EventEmitter } from 'events';

export interface PackageInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  size?: number;
  installDate?: Date;
}

export interface PackageInstallOptions {
  dev?: boolean;
  exact?: boolean;
  save?: boolean;
  force?: boolean;
  timeout?: number;
}

export interface PackageDetectionResult {
  imports: DetectedImport[];
  requires: DetectedRequire[];
  missing: string[];
  installed: string[];
  suggestions: PackageSuggestion[];
}

export interface DetectedImport {
  packageName: string;
  importPath: string;
  line: number;
  column: number;
  type: 'import' | 'require' | 'dynamic';
  isBuiltin: boolean;
}

export interface DetectedRequire {
  packageName: string;
  requirePath: string;
  line: number;
  column: number;
  isBuiltin: boolean;
}

export interface PackageSuggestion {
  packageName: string;
  reason: string;
  confidence: number;
  alternatives?: string[];
}

export interface PackageManagerConfig {
  autoInstall: boolean;
  autoDetect: boolean;
  timeout: number;
  maxConcurrentInstalls: number;
  allowedRegistries: string[];
  blockedPackages: string[];
  securityScan: boolean;
}

export interface InstallProgress {
  packageName: string;
  status: 'downloading' | 'installing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}

export class PackageManager extends EventEmitter {
  private webContainer: WebContainer | null = null;
  private config: PackageManagerConfig;
  private installedPackages: Map<string, PackageInfo> = new Map();
  private installQueue: Set<string> = new Set();
  private activeInstalls: Map<string, Promise<boolean>> = new Map();
  private packageCache: Map<string, Record<string, unknown>> = new Map();

  // Built-in Node.js modules that don't need installation
  private readonly builtinModules = new Set([
    'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns',
    'domain', 'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder', 'timers',
    'tls', 'tty', 'url', 'util', 'vm', 'zlib', 'constants', 'sys', 'module',
    'process', 'console', 'perf_hooks', 'async_hooks', 'worker_threads',
    'inspector', 'trace_events', 'v8'
  ]);

  // Common package aliases and alternatives
  private readonly packageAliases = new Map([
    ['lodash', ['ramda', 'underscore']],
    ['moment', ['dayjs', 'date-fns']],
    ['axios', ['fetch', 'node-fetch', 'got']],
    ['jquery', ['vanilla-js', 'cash-dom']],
    ['express', ['fastify', 'koa', 'hapi']],
    ['react', ['vue', 'angular', 'svelte']],
    ['webpack', ['vite', 'rollup', 'parcel']],
    ['jest', ['vitest', 'mocha', 'ava']],
    ['eslint', ['prettier', 'tslint', 'jshint']]
  ]);

  constructor(config?: Partial<PackageManagerConfig>) {
    super();
    
    this.config = {
      autoInstall: false, // Disable automatic installation - manage from editor
      autoDetect: true,
      timeout: 60000, // 60 seconds
      maxConcurrentInstalls: 3,
      allowedRegistries: ['https://registry.npmjs.org/'],
      blockedPackages: [],
      securityScan: true,
      ...config
    };
  }

  async initialize(webContainer: WebContainer): Promise<void> {
    this.webContainer = webContainer;
    
    try {
      // Initialize package.json if it doesn't exist
      await this.ensurePackageJson();
      
      // Load existing packages
      await this.loadInstalledPackages();
      
      this.emit('initialized');
    } catch (error) {
      this.emit('error', {
        type: 'initialization_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Package Installation
  async installPackage(
    packageName: string, 
    options: PackageInstallOptions = {}
  ): Promise<boolean> {
    if (!this.webContainer) {
      throw new Error('WebContainer not initialized');
    }

    // Validate package name
    if (!this.isValidPackageName(packageName)) {
      throw new Error(`Invalid package name: ${packageName}`);
    }

    // Check if package is blocked
    if (this.isPackageBlocked(packageName)) {
      throw new Error(`Package ${packageName} is blocked by security policy`);
    }

    // Check if already installing
    if (this.activeInstalls.has(packageName)) {
      return await this.activeInstalls.get(packageName)!;
    }

    // Check concurrent install limit
    if (this.activeInstalls.size >= this.config.maxConcurrentInstalls) {
      this.installQueue.add(packageName);
      this.emit('queued', { packageName });
      return new Promise((resolve) => {
        const checkQueue = () => {
          if (this.activeInstalls.size < this.config.maxConcurrentInstalls) {
            this.installQueue.delete(packageName);
            this.installPackage(packageName, options).then(resolve);
          } else {
            setTimeout(checkQueue, 1000);
          }
        };
        checkQueue();
      });
    }

    const installPromise = this.performInstall(packageName, options);
    this.activeInstalls.set(packageName, installPromise);

    try {
      const result = await installPromise;
      this.activeInstalls.delete(packageName);
      return result;
    } catch (error) {
      this.activeInstalls.delete(packageName);
      throw error;
    }
  }

  private async performInstall(
    packageName: string, 
    options: PackageInstallOptions
  ): Promise<boolean> {
    try {
      this.emit('installStarted', { packageName, options });
      console.log(`📦 Iniciando instalación de ${packageName}...`);

      // Security scan if enabled
      if (this.config.securityScan) {
        const scanResult = await this.performSecurityScan(packageName);
        if (!scanResult.safe) {
          throw new Error(`Security scan failed: ${scanResult.reason}`);
        }
      }

      // Build npm install arguments (simplified approach)
      const args = ['install'];
      
      if (options.dev) {
        args.push('--save-dev');
      } else if (options.save !== false) {
        args.push('--save');
      }

      if (options.exact) {
        args.push('--save-exact');
      }

      if (options.force) {
        args.push('--force');
      }

      args.push(packageName);
      
      console.log(`🔧 Ejecutando: npm ${args.join(' ')}`);
      
      // Execute installation using WebContainer spawn
      const installProcess = await this.webContainer!.spawn('npm', args);

      // Monitor output using the recommended WebContainers pattern
      let output = '';
      let errorOutput = '';

      // Pipe output to a WritableStream for monitoring
      installProcess.output.pipeTo(new WritableStream({
        write(data) {
          const text = data.toString();
          console.log(`[npm] ${text}`);
          output += text;
          
          // Check for errors
          if (text.includes('ERR!') || text.includes('ERROR')) {
            errorOutput += text;
          }
          
          // Emit progress events
          if (text.includes('downloading')) {
            console.log(`📥 Descargando ${packageName}...`);
          } else if (text.includes('installing')) {
            console.log(`⚙️ Instalando ${packageName}...`);
          }
        }
      }));

      // Wait for the installation to complete
      const exitCode = await installProcess.exit;
      
      console.log(`✅ Proceso npm terminado con código: ${exitCode}`);

      if (exitCode !== 0) {
        const errorMsg = `Installation failed with exit code ${exitCode}`;
        console.error(`❌ ${errorMsg}`);
        if (errorOutput) {
          console.error(`Error output: ${errorOutput}`);
        }
        throw new Error(`${errorMsg}: ${errorOutput || 'No error details available'}`);
      }

      // Verify installation by checking package.json
      await this.updatePackageInfo(packageName, options.dev || false);
      
      console.log(`🎉 ${packageName} instalado exitosamente`);
      
      this.emit('installCompleted', { 
        packageName, 
        success: true,
        output 
      });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error en instalación de ${packageName}:`, errorMessage);
      
      this.emit('installFailed', { 
        packageName, 
        error: errorMessage 
      });

      throw error;
    }
  }

  // Package Removal
  async removePackage(packageName: string): Promise<boolean> {
    if (!this.webContainer) {
      throw new Error('WebContainer not initialized');
    }

    if (!this.installedPackages.has(packageName)) {
      throw new Error(`Package ${packageName} is not installed`);
    }

    try {
      this.emit('removeStarted', { packageName });
      console.log(`🗑️ Iniciando desinstalación de ${packageName}...`);

      const uninstallProcess = await this.webContainer.spawn('npm', ['uninstall', packageName]);

      // Monitor output
      let output = '';
      let errorOutput = '';

      uninstallProcess.output.pipeTo(new WritableStream({
        write(data) {
          const text = data.toString();
          console.log(`[npm uninstall] ${text}`);
          output += text;
          
          if (text.includes('ERR!') || text.includes('ERROR')) {
            errorOutput += text;
          }
        }
      }));

      const exitCode = await uninstallProcess.exit;
      
      console.log(`✅ Proceso npm uninstall terminado con código: ${exitCode}`);

      if (exitCode !== 0) {
        const errorMsg = `Removal failed with exit code ${exitCode}`;
        console.error(`❌ ${errorMsg}`);
        if (errorOutput) {
          console.error(`Error output: ${errorOutput}`);
        }
        throw new Error(`${errorMsg}: ${errorOutput || 'No error details available'}`);
      }

      // Update internal state
      this.installedPackages.delete(packageName);
      this.packageCache.delete(packageName);

      console.log(`🎉 ${packageName} desinstalado exitosamente`);

      this.emit('removeCompleted', { packageName });
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error en desinstalación de ${packageName}:`, errorMessage);
      
      this.emit('removeFailed', { 
        packageName, 
        error: errorMessage 
      });

      throw error;
    }
  }

  // Dependency Detection
  async detectDependencies(code: string, filePath?: string): Promise<PackageDetectionResult> {
    const result: PackageDetectionResult = {
      imports: [],
      requires: [],
      missing: [],
      installed: [],
      suggestions: []
    };

    try {
      // Detect ES6 imports
      result.imports = this.detectImports(code);
      
      // Detect CommonJS requires
      result.requires = this.detectRequires(code);
      
      // Combine all detected packages
      const allPackages = new Set<string>();
      
      result.imports.forEach(imp => {
        if (!imp.isBuiltin) {
          allPackages.add(imp.packageName);
        }
      });
      
      result.requires.forEach(req => {
        if (!req.isBuiltin) {
          allPackages.add(req.packageName);
        }
      });

      // Check installation status
      for (const pkgName of allPackages) {
        if (this.installedPackages.has(pkgName)) {
          result.installed.push(pkgName);
        } else {
          result.missing.push(pkgName);
        }
      }

      // Generate suggestions
      result.suggestions = this.generateSuggestions(result.missing, filePath);

      this.emit('dependenciesDetected', {
        filePath,
        result
      });

      return result;

    } catch (error) {
      this.emit('detectionError', {
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  // Auto-install missing dependencies
  async autoInstallMissing(code: string, filePath?: string): Promise<string[]> {
    if (!this.config.autoInstall) {
      return [];
    }

    const detection = await this.detectDependencies(code, filePath);
    const installed: string[] = [];

    for (const packageName of detection.missing) {
      try {
        const success = await this.installPackage(packageName);
        if (success) {
          installed.push(packageName);
        }
      } catch (error) {
        this.emit('autoInstallFailed', {
          packageName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return installed;
  }

  // Package Information
  getInstalledPackages(): PackageInfo[] {
    return Array.from(this.installedPackages.values());
  }

  getPackageInfo(packageName: string): PackageInfo | null {
    return this.installedPackages.get(packageName) || null;
  }

  isPackageInstalled(packageName: string): boolean {
    return this.installedPackages.has(packageName);
  }

  // Utility Methods
  private detectImports(code: string): DetectedImport[] {
    const imports: DetectedImport[] = [];
    const lines = code.split('\n');

    // ES6 import patterns
    const staticImportPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    const dynamicImportPattern = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    lines.forEach((line, lineIndex) => {
      // Handle static imports
      let match;
      while ((match = staticImportPattern.exec(line)) !== null) {
        const importPath = match[1];
        
        imports.push({
          packageName: this.extractPackageName(importPath),
          importPath,
          line: lineIndex + 1,
          column: match.index,
          type: 'import',
          isBuiltin: this.builtinModules.has(this.extractPackageName(importPath))
        });
      }

      // Reset regex for dynamic imports
      dynamicImportPattern.lastIndex = 0;
      
      // Handle dynamic imports
      while ((match = dynamicImportPattern.exec(line)) !== null) {
        const importPath = match[1];
        
        imports.push({
          packageName: this.extractPackageName(importPath),
          importPath,
          line: lineIndex + 1,
          column: match.index,
          type: 'dynamic',
          isBuiltin: this.builtinModules.has(this.extractPackageName(importPath))
        });
      }
    });

    return imports;
  }

  private detectRequires(code: string): DetectedRequire[] {
    const requires: DetectedRequire[] = [];
    const lines = code.split('\n');

    // CommonJS require patterns
    const requirePattern = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

    lines.forEach((line, lineIndex) => {
      let match;
      while ((match = requirePattern.exec(line)) !== null) {
        const requirePath = match[1];
        
        requires.push({
          packageName: this.extractPackageName(requirePath),
          requirePath,
          line: lineIndex + 1,
          column: match.index,
          isBuiltin: this.builtinModules.has(this.extractPackageName(requirePath))
        });
      }
    });

    return requires;
  }

  private extractPackageName(importPath: string): string {
    // Handle relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return importPath;
    }

    // Handle scoped packages (@scope/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
    }

    // Handle regular packages (package/subpath)
    return importPath.split('/')[0];
  }

  private generateSuggestions(missingPackages: string[], filePath?: string): PackageSuggestion[] {
    const suggestions: PackageSuggestion[] = [];

    missingPackages.forEach(packageName => {
      // Check for common alternatives
      const alternatives = this.packageAliases.get(packageName);
      
      suggestions.push({
        packageName,
        reason: 'Missing dependency detected in code',
        confidence: 0.9,
        alternatives
      });

      // Context-based suggestions
      if (filePath) {
        const contextSuggestions = this.getContextualSuggestions(packageName, filePath);
        suggestions.push(...contextSuggestions);
      }
    });

    return suggestions;
  }

  private getContextualSuggestions(packageName: string, filePath: string): PackageSuggestion[] {
    const suggestions: PackageSuggestion[] = [];
    const fileExt = filePath.split('.').pop()?.toLowerCase();

    // TypeScript-specific suggestions
    if (fileExt === 'ts' || fileExt === 'tsx') {
      if (!packageName.startsWith('@types/')) {
        suggestions.push({
          packageName: `@types/${packageName}`,
          reason: 'TypeScript type definitions',
          confidence: 0.7
        });
      }
    }

    // Test file suggestions
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      const testPackages = ['jest', 'mocha', 'chai', 'sinon', 'supertest'];
      if (testPackages.includes(packageName)) {
        suggestions.push({
          packageName,
          reason: 'Test framework dependency',
          confidence: 0.8
        });
      }
    }

    return suggestions;
  }

  private async ensurePackageJson(): Promise<void> {
    if (!this.webContainer) return;

    try {
      // Check if package.json already exists
      const existingContent = await this.webContainer.fs.readFile('/package.json', 'utf-8');
      console.log('📄 package.json ya existe');
      
      // Validate existing package.json
      try {
        JSON.parse(existingContent);
        return; // Valid package.json exists
      } catch {
        console.log('⚠️ package.json existente es inválido, recreando...');
      }
    } catch {
      // package.json doesn't exist, create it
      console.log('📄 Creando package.json...');
    }

    // Create a WebContainer-compatible package.json
    const packageJson = {
      name: 'webcontainer-project',
      version: '1.0.0',
      description: 'WebContainer project for code execution',
      type: 'module', // Use ES modules for better WebContainer compatibility
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'node index.js',
        test: 'echo "No tests specified"'
      },
      dependencies: {},
      devDependencies: {},
      engines: {
        node: '>=18.0.0'
      }
    };

    try {
      await this.webContainer.fs.writeFile(
        '/package.json',
        JSON.stringify(packageJson, null, 2)
      );
      console.log('✅ package.json creado exitosamente');
    } catch (error) {
      console.error('❌ Error creando package.json:', error);
      throw new Error(`Failed to create package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadInstalledPackages(): Promise<void> {
    if (!this.webContainer) return;

    try {
      const packageJsonContent = await this.webContainer.fs.readFile('/package.json', 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Clear existing packages
      this.installedPackages.clear();

      // Load dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(packageJson.dependencies)) {
          this.installedPackages.set(name, {
            name,
            version: version as string,
            type: 'dependency'
          });
        }
      }

      // Load devDependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(packageJson.devDependencies)) {
          this.installedPackages.set(name, {
            name,
            version: version as string,
            type: 'devDependency'
          });
        }
      }

      // Emit event when packages are loaded
      this.emit('packagesLoaded', this.getInstalledPackages());

    } catch (error) {
      // Ignore errors, package.json might not exist yet
    }
  }

  private async updatePackageInfo(packageName: string, isDev: boolean): Promise<void> {
    try {
      // Force reload package.json to get latest dependencies
      const packageJsonContent = await this.webContainer!.fs.readFile('/package.json', 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check both dependencies and devDependencies
      const deps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};
      
      let version = deps[packageName] || devDeps[packageName];
      
      // If package not found in package.json, assume latest version
      if (!version) {
        version = 'latest';
        
        // Add to appropriate section
        if (isDev) {
          packageJson.devDependencies = { ...devDeps, [packageName]: version };
        } else {
          packageJson.dependencies = { ...deps, [packageName]: version };
        }
        
        // Save updated package.json
        await this.webContainer!.fs.writeFile('/package.json', JSON.stringify(packageJson, null, 2));
      }

      this.installedPackages.set(packageName, {
        name: packageName,
        version,
        type: isDev ? 'devDependency' : 'dependency',
        installDate: new Date()
      });
      
      // Emit event for package update
      this.emit('packageInstalled', {
        name: packageName,
        version,
        type: isDev ? 'devDependency' : 'dependency'
      });
    } catch (error) {
      // Handle error silently
      console.warn('Error updating package info:', error);
    }
  }

  private buildInstallCommand(packageName: string, options: PackageInstallOptions): string {
    let command = 'npm install';

    if (options.dev) {
      command += ' --save-dev';
    } else if (options.save !== false) {
      command += ' --save';
    }

    if (options.exact) {
      command += ' --save-exact';
    }

    if (options.force) {
      command += ' --force';
    }

    command += ` ${packageName}`;

    return command;
  }

  private parseInstallProgress(packageName: string, output: string): void {
    // Parse npm output for progress information
    if (output.includes('downloading')) {
      this.emit('installProgress', {
        packageName,
        status: 'downloading',
        progress: 25,
        message: 'Downloading package...'
      });
    } else if (output.includes('installing')) {
      this.emit('installProgress', {
        packageName,
        status: 'installing',
        progress: 75,
        message: 'Installing package...'
      });
    }
  }

  private async performSecurityScan(packageName: string): Promise<{ safe: boolean; reason?: string }> {
    // Basic security checks
    if (this.config.blockedPackages.includes(packageName)) {
      return { safe: false, reason: 'Package is in blocked list' };
    }

    // Check for suspicious patterns
    if (packageName.includes('..') || packageName.includes('/')) {
      return { safe: false, reason: 'Suspicious package name pattern' };
    }

    // Additional security checks could be added here
    // - Check against known vulnerability databases
    // - Validate package signatures
    // - Check package reputation

    return { safe: true };
  }

  private isValidPackageName(packageName: string): boolean {
    // npm package name validation
    const validNamePattern = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    return validNamePattern.test(packageName) && packageName.length <= 214;
  }

  private isPackageBlocked(packageName: string): boolean {
    return this.config.blockedPackages.includes(packageName);
  }

  // Configuration
  updateConfig(config: Partial<PackageManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', this.config);
  }

  getConfig(): PackageManagerConfig {
    return { ...this.config };
  }

  // Public method to refresh package list
  async refreshPackages(): Promise<void> {
    await this.loadInstalledPackages();
  }

  // Cleanup
  async destroy(): Promise<void> {
    // Cancel all active installations
    for (const [, promise] of this.activeInstalls) {
      try {
        await promise;
      } catch {
        // Ignore errors during cleanup
      }
    }

    this.activeInstalls.clear();
    this.installQueue.clear();
    this.installedPackages.clear();
    this.packageCache.clear();
    this.removeAllListeners();
  }
}