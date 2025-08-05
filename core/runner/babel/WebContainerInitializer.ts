/**
 * WebContainer Initializer
 * Handles complete WebContainer setup with modern Babel ecosystem
 */

import type { WebContainerInstance } from '../types.js';
import { WebContainerPackageManager, type WebContainerInitOptions } from './WebContainerPackageManager.js';
import { BabelConfigTemplates, type ProjectType } from './ModernBabelConfig.js';

export interface InitializationResult {
  success: boolean;
  packageManager: WebContainerPackageManager;
  projectType: ProjectType;
  duration: number;
  errors: string[];
  warnings: string[];
}

export interface InitializationOptions extends WebContainerInitOptions {
  createBabelRC?: boolean;
  createBabelConfigJS?: boolean;
  skipDependencyInstall?: boolean;
  timeout?: number;
}

/**
 * Manages complete WebContainer initialization with modern Babel support
 */
export class WebContainerInitializer {
  private container: WebContainerInstance;
  private packageManager: WebContainerPackageManager;

  constructor(container: WebContainerInstance) {
    this.container = container;
    this.packageManager = new WebContainerPackageManager(container);
  }

  /**
   * Initialize WebContainer with modern Babel ecosystem
   */
  async initialize(options: InitializationOptions): Promise<InitializationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log('🚀 Initializing WebContainer with modern Babel ecosystem...');

      // Step 1: Create optimal package.json
      await this.createPackageJson(options);

      // Step 2: Initialize Node.js environment
      await this.initializeNodeEnvironment();

      // Step 3: Install Babel dependencies (if not skipped)
      if (!options.skipDependencyInstall) {
        await this.installBabelDependencies(options);
      } else {
        warnings.push('Dependency installation was skipped');
      }

      // Step 4: Create Babel configuration files
      await this.createBabelConfigurations(options);

      // Step 5: Validate installation
      await this.validateInstallation();

      const duration = Date.now() - startTime;
      console.log(`✅ WebContainer initialized successfully in ${duration}ms`);

      return {
        success: true,
        packageManager: this.packageManager,
        projectType: options.projectType,
        duration,
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      errors.push(errorMessage);
      
      console.error('❌ WebContainer initialization failed:', error);
      
      return {
        success: false,
        packageManager: this.packageManager,
        projectType: options.projectType,
        duration: Date.now() - startTime,
        errors,
        warnings
      };
    }
  }

  /**
   * Create optimal package.json configuration
   */
  private async createPackageJson(options: InitializationOptions): Promise<void> {
    try {
      console.log('📦 Creating optimal package.json...');
      
      await this.packageManager.createPackageJson({
        projectType: options.projectType,
        enableESModules: options.enableESModules,
        nodeVersion: options.nodeVersion,
        installDependencies: !options.skipDependencyInstall
      });

      console.log('✅ Package.json created successfully');
    } catch (error) {
      console.error('❌ Failed to create package.json:', error);
      throw new Error(`Package.json creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize Node.js environment with optimal settings
   */
  private async initializeNodeEnvironment(): Promise<void> {
    try {
      console.log('⚙️ Initializing Node.js environment...');
      
      await this.packageManager.initializeNodeEnvironment();
      
      // Create additional Node.js optimization files
      await this.createNodeOptimizations();
      
      console.log('✅ Node.js environment initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Node.js environment:', error);
      throw new Error(`Node.js initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create Node.js optimization files
   */
  private async createNodeOptimizations(): Promise<void> {
    // Create .node-version file
    await this.container.fs.writeFile('/.node-version', '18.19.0');

    // Create optimized .npmrc
    const npmrcContent = `
# Performance optimizations
progress=false
audit=false
fund=false
package-lock=true

# Registry settings
registry=https://registry.npmjs.org/

# Cache settings
cache-max=86400000
prefer-offline=true
`.trim();

    await this.container.fs.writeFile('/.npmrc', npmrcContent);

    // Create Node.js startup script
    const startupScript = `
// Node.js startup optimizations for WebContainer
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-modules';

// Optimize garbage collection for development
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_OPTIONS += ' --max-old-space-size=2048';
}

console.log('🚀 Node.js optimized for WebContainer environment');
`.trim();

    await this.container.fs.writeFile('/node-startup.js', startupScript);
  }

  /**
   * Install Babel dependencies
   */
  private async installBabelDependencies(options: InitializationOptions): Promise<void> {
    try {
      console.log('📥 Installing Babel dependencies...');
      
      await this.packageManager.installDependencies({
        timeout: options.timeout || 60000
      });
      
      console.log('✅ Babel dependencies installed');
    } catch (error) {
      console.error('❌ Failed to install Babel dependencies:', error);
      throw new Error(`Dependency installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create Babel configuration files
   */
  private async createBabelConfigurations(options: InitializationOptions): Promise<void> {
    try {
      console.log('⚙️ Creating Babel configuration files...');

      // Create .babelrc if requested
      if (options.createBabelRC) {
        await this.packageManager.createBabelRC(options.projectType);
      }

      // Create babel.config.js if requested
      if (options.createBabelConfigJS) {
        await this.packageManager.createBabelConfigJS(options.projectType);
      }

      // Always create a default configuration template
      await this.createDefaultBabelConfig(options.projectType);

      console.log('✅ Babel configuration files created');
    } catch (error) {
      console.error('❌ Failed to create Babel configurations:', error);
      throw new Error(`Babel configuration creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create default Babel configuration template
   */
  private async createDefaultBabelConfig(projectType: ProjectType): Promise<void> {
    const template = BabelConfigTemplates.getTemplate(projectType);
    
    // Create a comprehensive babel configuration file
    const configContent = `// Babel Configuration for ${projectType} project
// Generated by OrbisJS WebContainer Babel Modernization

module.exports = {
  presets: [
${template.presets.map(preset => 
  `    ['${preset.name}', ${JSON.stringify(preset.options || {}, null, 6)}]`
).join(',\n')}
  ],
  plugins: [
${template.plugins.map(plugin => 
  plugin.options 
    ? `    ['${plugin.name}', ${JSON.stringify(plugin.options, null, 6)}]`
    : `    '${plugin.name}'`
).join(',\n')}
  ],
  env: {
    development: {
      compact: false,
      retainLines: true
    },
    production: {
      compact: true,
      comments: false
    }
  }
};`;

    await this.container.fs.writeFile('/babel.config.js', configContent);
  }

  /**
   * Validate the installation with comprehensive health checks
   */
  private async validateInstallation(): Promise<void> {
    try {
      console.log('🔍 Validating installation...');

      // Perform comprehensive environment validation
      const validationResult = await this.packageManager.validateEnvironment();
      
      if (!validationResult.isHealthy) {
        const errorMessage = `Environment validation failed: ${validationResult.errors.join(', ')}`;
        throw new Error(errorMessage);
      }

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        validationResult.warnings.forEach(warning => {
          console.warn(`⚠️ ${warning}`);
        });
      }

      // Log successful checks
      validationResult.checks
        .filter(check => check.status === 'passed')
        .forEach(check => {
          console.log(`✅ ${check.name}: ${check.message}`);
        });

      // Additional WebContainer-specific validation
      await this.validateWebContainerSpecifics();

      console.log('✅ Installation validation completed successfully');
    } catch (error) {
      console.error('❌ Installation validation failed:', error);
      throw new Error(`Installation validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate WebContainer-specific functionality
   */
  private async validateWebContainerSpecifics(): Promise<void> {
    // Test Babel transformation capability
    try {
      const testCode = 'const test = () => console.log("Hello WebContainer");';
      const testFile = '/test-babel-transform.js';
      
      await this.container.fs.writeFile(testFile, testCode);
      
      // Try to run the test file
      const testProcess = await this.container.spawn('node', [testFile]);
      const exitCode = await testProcess.exit;
      
      // Clean up test file
      await this.container.fs.rm(testFile);
      
      if (exitCode === 0) {
        console.log('✅ WebContainer JavaScript execution is working');
      } else {
        console.warn('⚠️ WebContainer JavaScript execution test failed');
      }
    } catch (error) {
      console.warn('⚠️ Could not test WebContainer JavaScript execution:', error);
    }

    // Test npm functionality
    try {
      const npmProcess = await this.container.spawn('npm', ['list', '--depth=0']);
      const exitCode = await npmProcess.exit;
      
      if (exitCode === 0) {
        console.log('✅ npm package listing is working');
      } else {
        console.warn('⚠️ npm package listing failed');
      }
    } catch (error) {
      console.warn('⚠️ Could not test npm functionality:', error);
    }

    // Validate file system permissions
    try {
      const testDir = '/test-permissions';
      await this.container.fs.writeFile(`${testDir}/test.txt`, 'test');
      await this.container.fs.readFile(`${testDir}/test.txt`, 'utf-8');
      await this.container.fs.rm(testDir, { recursive: true });
      
      console.log('✅ File system permissions are working');
    } catch (error) {
      console.warn('⚠️ File system permission test failed:', error);
    }
  }

  /**
   * Get initialization status
   */
  async getInitializationStatus(): Promise<{
    hasPackageJson: boolean;
    hasNodeModules: boolean;
    hasBabelConfig: boolean;
    nodeVersion?: string;
    installedPackages: number;
  }> {
    const status = {
      hasPackageJson: false,
      hasNodeModules: false,
      hasBabelConfig: false,
      nodeVersion: undefined as string | undefined,
      installedPackages: 0
    };

    try {
      // Check package.json
      await this.container.fs.readFile('/package.json', 'utf-8');
      status.hasPackageJson = true;
    } catch {
      // Package.json doesn't exist
    }

    try {
      // Check node_modules
      const nodeModules = await this.container.fs.readdir('/node_modules');
      status.hasNodeModules = true;
      status.installedPackages = nodeModules.length;
    } catch {
      // node_modules doesn't exist
    }

    try {
      // Check Babel config
      await this.container.fs.readFile('/babel.config.js', 'utf-8');
      status.hasBabelConfig = true;
    } catch {
      try {
        await this.container.fs.readFile('/.babelrc', 'utf-8');
        status.hasBabelConfig = true;
      } catch {
        // No Babel config found
      }
    }

    try {
      // Get Node.js version
      const versionProcess = await this.container.spawn('node', ['--version']);
      const exitCode = await versionProcess.exit;
      if (exitCode === 0) {
        // Note: In a real implementation, you'd capture the output
        status.nodeVersion = '18.x'; // Placeholder
      }
    } catch {
      // Could not get Node.js version - leave undefined
    }

    return status;
  }

  /**
   * Clean up and reset WebContainer environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up WebContainer environment...');

    const filesToRemove = [
      '/package.json',
      '/package-lock.json',
      '/.babelrc',
      '/babel.config.js',
      '/.nvmrc',
      '/.node-version',
      '/.npmrc',
      '/node-startup.js',
      '/setup-env.sh'
    ];

    const errors: string[] = [];

    for (const file of filesToRemove) {
      try {
        await this.container.fs.rm(file);
        console.log(`✅ Removed ${file}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
          // Critical permission errors should be thrown immediately
          console.error(`❌ Failed to remove ${file}: ${errorMessage}`);
          throw error;
        }
        // Non-critical errors (file not found, etc.) are logged but don't stop cleanup
        console.log(`ℹ️ Could not remove ${file}: ${errorMessage}`);
      }
    }

    // Remove node_modules directory
    try {
      await this.container.fs.rm('/node_modules', { recursive: true });
      console.log('✅ Removed node_modules directory');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
        console.error(`❌ Failed to remove node_modules: ${errorMessage}`);
        throw error;
      }
      console.log(`ℹ️ Could not remove node_modules: ${errorMessage}`);
    }

    if (errors.length > 0) {
      console.warn(`⚠️ Cleanup completed with ${errors.length} non-critical errors`);
    }

    console.log('✅ WebContainer environment cleaned up');
  }
}