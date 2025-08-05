/**
 * WebContainer Package Manager
 * Manages package.json creation and dependency installation for modern Babel ecosystem
 */

import type { WebContainerInstance } from '../types.js';
import { BabelDependencies, type ProjectType } from './ModernBabelConfig.js';

export interface PackageJsonTemplate {
  name: string;
  version: string;
  type: 'module' | 'commonjs';
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  babel?: BabelPackageConfig;
  engines?: {
    node: string;
  };
  browserslist?: string[] | Record<string, string[]>;
  main?: string;
  exports?: Record<string, unknown> | string;
  sideEffects?: boolean;
}

export interface BabelPackageConfig {
  presets: Array<string | [string, any]>;
  plugins: Array<string | [string, any]>;
  env?: Record<string, Partial<BabelPackageConfig>>;
}

export interface WebContainerInitOptions {
  projectType: ProjectType;
  enableESModules: boolean;
  nodeVersion: string;
  installDependencies: boolean;
  moduleSystem?: 'esm' | 'commonjs' | 'auto';
  targetEnvironment?: 'node' | 'browser' | 'universal';
  optimizeForDevelopment?: boolean;
}

export interface EnvironmentValidationResult {
  isHealthy: boolean;
  checks: EnvironmentCheck[];
  warnings: string[];
  errors: string[];
}

export interface EnvironmentCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
}

export interface DetectedFeature {
  name: string;
  type: 'syntax' | 'api' | 'framework';
  confidence: number;
}

export interface InstallationResult {
  success: boolean;
  installedPackages: string[];
  skippedPackages: string[];
  errors: string[];
}

/**
 * Manages WebContainer package.json and dependency installation
 */
export class WebContainerPackageManager {
  private container: WebContainerInstance;

  constructor(container: WebContainerInstance) {
    this.container = container;
  }

  /**
   * Create optimal package.json for WebContainer environment
   */
  async createPackageJson(options: WebContainerInitOptions): Promise<PackageJsonTemplate> {
    const { 
      projectType, 
      enableESModules, 
      nodeVersion,
      moduleSystem = 'auto',
      targetEnvironment = 'node',
      optimizeForDevelopment = true
    } = options;
    
    const { dependencies, devDependencies } = BabelDependencies.getDependenciesForType(projectType);

    // Determine module type based on options
    const moduleType = this.determineModuleType(enableESModules, moduleSystem);
    
    // Add environment-specific dependencies
    const enhancedDependencies = this.addEnvironmentDependencies(
      dependencies, 
      targetEnvironment, 
      optimizeForDevelopment
    );
    
    const enhancedDevDependencies = this.addDevelopmentDependencies(
      devDependencies,
      projectType,
      optimizeForDevelopment
    );

    const packageJson: PackageJsonTemplate = {
      name: 'orbisjs-webcontainer-project',
      version: '1.0.0',
      type: moduleType,
      scripts: this.createScripts(projectType, enableESModules, targetEnvironment),
      dependencies: enhancedDependencies,
      devDependencies: enhancedDevDependencies,
      babel: this.createBabelPackageConfig(projectType, targetEnvironment, moduleSystem),
      engines: {
        node: nodeVersion
      },
      // Add WebContainer-specific optimizations
      browserslist: this.createBrowserslistConfig(targetEnvironment),
      // Add Node.js specific configurations
      main: moduleType === 'module' ? './index.js' : './index.js',
      exports: this.createExportsConfig(moduleType),
      // Performance optimizations
      sideEffects: false
    };

    // Write package.json to WebContainer
    await this.container.fs.writeFile(
      '/package.json',
      JSON.stringify(packageJson, null, 2)
    );

    console.log('✅ Created optimal package.json for WebContainer');
    return packageJson;
  }

  /**
   * Determine module type based on options
   */
  private determineModuleType(enableESModules: boolean, moduleSystem: string): 'module' | 'commonjs' {
    if (moduleSystem === 'esm') return 'module';
    if (moduleSystem === 'commonjs') return 'commonjs';
    return enableESModules ? 'module' : 'commonjs';
  }

  /**
   * Add environment-specific dependencies
   */
  private addEnvironmentDependencies(
    baseDependencies: Record<string, string>,
    targetEnvironment: string,
    optimizeForDevelopment: boolean
  ): Record<string, string> {
    const enhanced = { ...baseDependencies };

    if (targetEnvironment === 'browser' || targetEnvironment === 'universal') {
      enhanced['core-js'] = '^3.36.0';
      enhanced['regenerator-runtime'] = '^0.14.1';
    }

    if (optimizeForDevelopment) {
      enhanced['source-map-support'] = '^0.5.21';
    }

    return enhanced;
  }

  /**
   * Add development-specific dependencies
   */
  private addDevelopmentDependencies(
    baseDevDependencies: Record<string, string>,
    projectType: ProjectType,
    optimizeForDevelopment: boolean
  ): Record<string, string> {
    const enhanced = { ...baseDevDependencies };

    if (optimizeForDevelopment) {
      enhanced['@babel/plugin-transform-optional-chaining'] = '^7.24.0';
      enhanced['@babel/plugin-transform-nullish-coalescing-operator'] = '^7.24.0';
      enhanced['@babel/plugin-transform-logical-assignment-operators'] = '^7.24.0';
    }

    // Add project-specific development tools
    if (projectType === 'typescript') {
      enhanced['typescript'] = '^5.3.0';
    }

    return enhanced;
  }

  /**
   * Create browserslist configuration
   */
  private createBrowserslistConfig(targetEnvironment: string): string[] | Record<string, string[]> {
    switch (targetEnvironment) {
      case 'browser':
        return [
          'last 2 Chrome versions',
          'last 2 Firefox versions',
          'last 2 Safari versions',
          'last 2 Edge versions'
        ];
      case 'universal':
        return {
          production: ['> 1%', 'not dead'],
          development: ['last 1 Chrome version', 'last 1 Firefox version']
        };
      case 'node':
      default:
        return [`node ${process.version.slice(1)}`];
    }
  }

  /**
   * Create exports configuration for package.json
   */
  private createExportsConfig(moduleType: 'module' | 'commonjs'): Record<string, unknown> | string {
    if (moduleType === 'module') {
      return {
        '.': {
          import: './index.js',
          types: './index.d.ts'
        },
        './package.json': './package.json'
      };
    }
    return './index.js';
  }

  /**
   * Create scripts section based on project type
   */
  private createScripts(projectType: ProjectType, esModules: boolean, targetEnvironment = 'node'): Record<string, string> {
    const baseScripts = {
      dev: esModules ? 'node --experimental-modules index.js' : 'node index.js',
      build: 'babel src --out-dir dist',
      test: 'node --test'
    };

    switch (projectType) {
      case 'react':
        return {
          ...baseScripts,
          'build:react': 'babel src --out-dir dist --presets=@babel/preset-react',
          'dev:react': 'babel-node --presets=@babel/preset-react,@babel/preset-env src/index.jsx'
        };
      case 'typescript':
        return {
          ...baseScripts,
          'build:ts': 'babel src --out-dir dist --extensions=.ts,.tsx',
          'type-check': 'tsc --noEmit'
        };
      case 'solid':
        return {
          ...baseScripts,
          'build:solid': 'babel src --out-dir dist --presets=solid',
          'dev:solid': 'babel-node --presets=solid,@babel/preset-env src/index.jsx'
        };
      case 'vue':
        return {
          ...baseScripts,
          'build:vue': 'babel src --out-dir dist --presets=@vue/babel-preset-jsx'
        };
      default:
        return baseScripts;
    }
  }

  /**
   * Create Babel configuration for package.json
   */
  private createBabelPackageConfig(
    projectType: ProjectType, 
    targetEnvironment = 'node', 
    moduleSystem = 'auto'
  ): BabelPackageConfig {
    const targets = this.createBabelTargets(targetEnvironment);
    const modules = moduleSystem === 'esm' ? false : moduleSystem === 'commonjs' ? 'commonjs' : 'auto';

    switch (projectType) {
      case 'javascript':
        return {
          presets: [
            ['@babel/preset-env', {
              targets,
              modules,
              useBuiltIns: targetEnvironment === 'browser' ? 'usage' : false,
              corejs: targetEnvironment === 'browser' ? 3 : undefined
            }]
          ],
          plugins: [
            '@babel/plugin-transform-runtime',
            '@babel/plugin-transform-optional-chaining',
            '@babel/plugin-transform-nullish-coalescing-operator',
            '@babel/plugin-transform-logical-assignment-operators'
          ]
        };

      case 'typescript':
        return {
          presets: [
            '@babel/preset-typescript',
            ['@babel/preset-env', {
              targets,
              modules,
              useBuiltIns: targetEnvironment === 'browser' ? 'usage' : false,
              corejs: targetEnvironment === 'browser' ? 3 : undefined
            }]
          ],
          plugins: [
            ['@babel/plugin-proposal-decorators', { version: '2023-05' }],
            '@babel/plugin-proposal-class-properties',
            '@babel/plugin-transform-runtime',
            '@babel/plugin-transform-optional-chaining',
            '@babel/plugin-transform-nullish-coalescing-operator'
          ]
        };

      case 'react':
        return {
          presets: [
            ['@babel/preset-react', {
              runtime: 'automatic',
              development: targetEnvironment !== 'production'
            }],
            '@babel/preset-typescript',
            ['@babel/preset-env', {
              targets,
              modules,
              useBuiltIns: targetEnvironment === 'browser' ? 'usage' : false,
              corejs: targetEnvironment === 'browser' ? 3 : undefined
            }]
          ],
          plugins: [
            '@babel/plugin-transform-react-jsx-development',
            '@babel/plugin-transform-runtime'
          ]
        };

      case 'solid':
        return {
          presets: [
            ['solid', {
              generate: 'dom',
              hydratable: false,
              dev: targetEnvironment !== 'production'
            }],
            '@babel/preset-typescript',
            ['@babel/preset-env', {
              targets,
              modules,
              useBuiltIns: targetEnvironment === 'browser' ? 'usage' : false,
              corejs: targetEnvironment === 'browser' ? 3 : undefined
            }]
          ],
          plugins: [
            '@babel/plugin-transform-runtime'
          ]
        };

      case 'vue':
        return {
          presets: [
            ['@vue/babel-preset-jsx', {
              compositionAPI: true
            }],
            '@babel/preset-typescript',
            ['@babel/preset-env', {
              targets,
              modules,
              useBuiltIns: targetEnvironment === 'browser' ? 'usage' : false,
              corejs: targetEnvironment === 'browser' ? 3 : undefined
            }]
          ],
          plugins: [
            '@babel/plugin-transform-runtime'
          ]
        };

      case 'node':
        return {
          presets: [
            ['@babel/preset-env', {
              targets: { node: '18' },
              modules: 'commonjs'
            }]
          ],
          plugins: [
            '@babel/plugin-transform-runtime'
          ]
        };

      default:
        return this.createBabelPackageConfig('javascript', targetEnvironment, moduleSystem);
    }
  }

  /**
   * Create Babel targets based on environment
   */
  private createBabelTargets(targetEnvironment: string): Record<string, string> | string[] {
    switch (targetEnvironment) {
      case 'browser':
        return {
          browsers: ['last 2 versions', '> 1%', 'not dead']
        };
      case 'universal':
        return {
          node: '18',
          browsers: ['last 2 versions']
        };
      case 'node':
      default:
        return { node: '18' };
    }
  }

  /**
   * Install Babel dependencies in WebContainer
   */
  async installDependencies(options: { timeout?: number } = {}): Promise<void> {
    const { timeout = 60000 } = options;

    try {
      console.log('📦 Installing Babel dependencies in WebContainer...');

      // Install dependencies using npm
      const installProcess = await this.container.spawn('npm', ['install'], {
        env: {
          NODE_ENV: 'development',
          NPM_CONFIG_PROGRESS: 'false',
          NPM_CONFIG_AUDIT: 'false',
          NPM_CONFIG_FUND: 'false'
        }
      });

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          installProcess.kill();
          reject(new Error(`Dependency installation timeout after ${timeout}ms`));
        }, timeout);
      });

      // Wait for installation to complete
      const exitCode = await Promise.race([
        installProcess.exit,
        timeoutPromise
      ]);

      if (exitCode !== 0) {
        throw new Error(`npm install failed with exit code ${exitCode}`);
      }

      console.log('✅ Babel dependencies installed successfully');

      // Verify critical dependencies are available
      await this.verifyDependencies();

    } catch (error) {
      console.error('❌ Failed to install dependencies:', error);
      throw new Error(`Dependency installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify that critical Babel dependencies are installed
   */
  private async verifyDependencies(): Promise<void> {
    const criticalDependencies = [
      '@babel/core',
      '@babel/preset-env',
      '@babel/preset-typescript',
      '@babel/plugin-transform-runtime'
    ];

    for (const dep of criticalDependencies) {
      try {
        const packagePath = `/node_modules/${dep}/package.json`;
        await this.container.fs.readFile(packagePath, 'utf-8');
        console.log(`✅ Verified ${dep} installation`);
      } catch (error) {
        console.warn(`⚠️ Could not verify ${dep} installation:`, error);
        throw new Error(`Critical dependency ${dep} not found after installation`);
      }
    }
  }

  /**
   * Create .babelrc file for project-specific configuration
   */
  async createBabelRC(projectType: ProjectType): Promise<void> {
    const babelConfig = this.createBabelPackageConfig(projectType);
    
    await this.container.fs.writeFile(
      '/.babelrc',
      JSON.stringify(babelConfig, null, 2)
    );

    console.log('✅ Created .babelrc configuration file');
  }

  /**
   * Create babel.config.js for advanced configuration
   */
  async createBabelConfigJS(projectType: ProjectType): Promise<void> {
    const babelConfig = this.createBabelPackageConfig(projectType);
    
    const configContent = `module.exports = ${JSON.stringify(babelConfig, null, 2)};`;
    
    await this.container.fs.writeFile('/babel.config.js', configContent);
    console.log('✅ Created babel.config.js configuration file');
  }

  /**
   * Initialize WebContainer with optimal Node.js settings
   */
  async initializeNodeEnvironment(): Promise<void> {
    try {
      // Create .nvmrc for Node version specification
      await this.container.fs.writeFile('/.nvmrc', '18');

      // Create basic index.js if it doesn't exist
      try {
        await this.container.fs.readFile('/index.js', 'utf-8');
      } catch {
        await this.container.fs.writeFile(
          '/index.js',
          '// OrbisJS WebContainer Entry Point\nconsole.log("WebContainer initialized with modern Babel support");'
        );
      }

      // Set up optimal Node.js environment variables
      const nodeEnvScript = `#!/bin/bash
export NODE_OPTIONS="--experimental-modules --experimental-json-modules"
export NODE_ENV="development"
`;
      
      await this.container.fs.writeFile('/setup-env.sh', nodeEnvScript);
      
      console.log('✅ Node.js environment initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Node.js environment:', error);
      throw error;
    }
  }

  /**
   * Get current package.json content
   */
  async getPackageJson(): Promise<PackageJsonTemplate | null> {
    try {
      const content = await this.container.fs.readFile('/package.json', 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('Could not read package.json:', error);
      return null;
    }
  }

  /**
   * Update package.json with new dependencies
   */
  async updatePackageJson(updates: Partial<PackageJsonTemplate>): Promise<void> {
    const current = await this.getPackageJson();
    if (!current) {
      throw new Error('No package.json found to update');
    }

    const updated = {
      ...current,
      ...updates,
      dependencies: {
        ...current.dependencies,
        ...updates.dependencies
      },
      devDependencies: {
        ...current.devDependencies,
        ...updates.devDependencies
      }
    };

    await this.container.fs.writeFile(
      '/package.json',
      JSON.stringify(updated, null, 2)
    );

    console.log('✅ Updated package.json');
  }

  /**
   * Validate WebContainer environment health
   */
  async validateEnvironment(): Promise<EnvironmentValidationResult> {
    const result: EnvironmentValidationResult = {
      isHealthy: true,
      checks: [],
      warnings: [],
      errors: []
    };

    // Check Node.js availability and version
    try {
      const nodeProcess = await this.container.spawn('node', ['--version']);
      const exitCode = await nodeProcess.exit;
      
      if (exitCode === 0) {
        result.checks.push({
          name: 'Node.js availability',
          status: 'passed',
          message: 'Node.js is available and working'
        });
      } else {
        result.checks.push({
          name: 'Node.js availability',
          status: 'failed',
          message: 'Node.js command failed'
        });
        result.isHealthy = false;
        result.errors.push('Node.js is not working properly');
      }
    } catch (error) {
      result.checks.push({
        name: 'Node.js availability',
        status: 'failed',
        message: `Node.js check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      result.isHealthy = false;
      result.errors.push('Node.js is not available');
    }

    // Check npm availability
    try {
      const npmProcess = await this.container.spawn('npm', ['--version']);
      const exitCode = await npmProcess.exit;
      
      if (exitCode === 0) {
        result.checks.push({
          name: 'npm availability',
          status: 'passed',
          message: 'npm is available and working'
        });
      } else {
        result.checks.push({
          name: 'npm availability',
          status: 'failed',
          message: 'npm command failed'
        });
        result.warnings.push('npm may not be working properly');
      }
    } catch (error) {
      result.checks.push({
        name: 'npm availability',
        status: 'failed',
        message: `npm check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      result.warnings.push('npm is not available - dependency installation may fail');
    }

    // Check package.json validity
    try {
      const packageJson = await this.getPackageJson();
      if (packageJson) {
        result.checks.push({
          name: 'package.json validity',
          status: 'passed',
          message: 'package.json is valid and readable'
        });

        // Validate required fields
        if (!packageJson.name || !packageJson.version) {
          result.warnings.push('package.json is missing required fields (name or version)');
        }

        // Check for Babel configuration
        if (!packageJson.babel && !packageJson.devDependencies['@babel/core']) {
          result.warnings.push('No Babel configuration found in package.json');
        }
      } else {
        result.checks.push({
          name: 'package.json validity',
          status: 'failed',
          message: 'package.json not found or invalid'
        });
        result.warnings.push('package.json is missing or invalid');
      }
    } catch (error) {
      result.checks.push({
        name: 'package.json validity',
        status: 'failed',
        message: `package.json validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      result.warnings.push('package.json validation failed');
    }

    // Check node_modules directory
    try {
      const nodeModules = await this.container.fs.readdir('/node_modules');
      if (nodeModules.length > 0) {
        result.checks.push({
          name: 'Dependencies installation',
          status: 'passed',
          message: `Found ${nodeModules.length} installed packages`
        });
      } else {
        result.checks.push({
          name: 'Dependencies installation',
          status: 'warning',
          message: 'node_modules directory is empty'
        });
        result.warnings.push('No dependencies appear to be installed');
      }
    } catch (error) {
      result.checks.push({
        name: 'Dependencies installation',
        status: 'failed',
        message: 'node_modules directory not found'
      });
      result.warnings.push('Dependencies may not be installed');
    }

    // Check critical Babel dependencies
    const criticalDeps = ['@babel/core', '@babel/preset-env'];
    for (const dep of criticalDeps) {
      try {
        await this.container.fs.readFile(`/node_modules/${dep}/package.json`, 'utf-8');
        result.checks.push({
          name: `${dep} installation`,
          status: 'passed',
          message: `${dep} is properly installed`
        });
      } catch (error) {
        result.checks.push({
          name: `${dep} installation`,
          status: 'failed',
          message: `${dep} is not installed`
        });
        result.isHealthy = false;
        result.errors.push(`Critical dependency ${dep} is missing`);
      }
    }

    // Check file system permissions
    try {
      const testFile = '/test-write-permissions.tmp';
      await this.container.fs.writeFile(testFile, 'test');
      await this.container.fs.rm(testFile);
      
      result.checks.push({
        name: 'File system permissions',
        status: 'passed',
        message: 'File system is writable'
      });
    } catch (error) {
      result.checks.push({
        name: 'File system permissions',
        status: 'failed',
        message: 'File system write test failed'
      });
      result.isHealthy = false;
      result.errors.push('File system is not writable');
    }

    return result;
  }

  /**
   * Automatically install detected Babel presets and plugins
   */
  async installDetectedDependencies(detectedFeatures: DetectedFeature[]): Promise<InstallationResult> {
    const result: InstallationResult = {
      success: true,
      installedPackages: [],
      skippedPackages: [],
      errors: []
    };

    const packagesToInstall = new Set<string>();

    // Map detected features to required packages
    for (const feature of detectedFeatures) {
      const requiredPackages = this.mapFeatureToPackages(feature);
      requiredPackages.forEach(pkg => packagesToInstall.add(pkg));
    }

    if (packagesToInstall.size === 0) {
      console.log('ℹ️ No additional packages needed for detected features');
      return result;
    }

    console.log(`📦 Installing ${packagesToInstall.size} detected dependencies...`);

    // Check which packages are already installed
    const currentPackageJson = await this.getPackageJson();
    const installedPackages = new Set([
      ...Object.keys(currentPackageJson?.dependencies || {}),
      ...Object.keys(currentPackageJson?.devDependencies || {})
    ]);

    const packagesNeedingInstallation = Array.from(packagesToInstall)
      .filter(pkg => !installedPackages.has(pkg));

    if (packagesNeedingInstallation.length === 0) {
      console.log('✅ All required packages are already installed');
      result.skippedPackages = Array.from(packagesToInstall);
      return result;
    }

    try {
      // Install packages with optimized npm settings
      const installArgs = [
        'install', 
        '--save-dev',
        '--no-audit',
        '--no-fund',
        '--progress=false',
        ...packagesNeedingInstallation
      ];
      
      const installProcess = await this.container.spawn('npm', installArgs, {
        env: {
          NODE_ENV: 'development',
          NPM_CONFIG_PROGRESS: 'false',
          NPM_CONFIG_AUDIT: 'false',
          NPM_CONFIG_FUND: 'false',
          NPM_CONFIG_LOGLEVEL: 'error'
        }
      });

      const exitCode = await installProcess.exit;

      if (exitCode === 0) {
        result.installedPackages = packagesNeedingInstallation;
        console.log(`✅ Successfully installed ${packagesNeedingInstallation.length} packages`);
        
        // Update package.json with new dependencies
        await this.updatePackageJsonWithNewDependencies(packagesNeedingInstallation);
        
        // Verify installation
        await this.verifyPackageInstallation(packagesNeedingInstallation);
      } else {
        result.success = false;
        result.errors.push(`npm install failed with exit code ${exitCode}`);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Update package.json with newly installed dependencies
   */
  private async updatePackageJsonWithNewDependencies(packages: string[]): Promise<void> {
    try {
      const currentPackageJson = await this.getPackageJson();
      if (!currentPackageJson) {
        throw new Error('Package.json not found');
      }

      // Add packages to devDependencies with latest versions
      const updatedDevDependencies = { ...currentPackageJson.devDependencies };
      
      for (const pkg of packages) {
        if (!updatedDevDependencies[pkg]) {
          // Use a default version - npm install will resolve the actual version
          updatedDevDependencies[pkg] = '^7.24.0'; // Default Babel version
        }
      }

      await this.updatePackageJson({
        devDependencies: updatedDevDependencies
      });

      console.log('✅ Updated package.json with new dependencies');
    } catch (error) {
      console.warn('⚠️ Could not update package.json with new dependencies:', error);
    }
  }

  /**
   * Verify that packages were installed correctly
   */
  private async verifyPackageInstallation(packages: string[]): Promise<void> {
    const failedPackages: string[] = [];

    for (const pkg of packages) {
      try {
        const packagePath = `/node_modules/${pkg}/package.json`;
        await this.container.fs.readFile(packagePath, 'utf-8');
        console.log(`✅ Verified installation of ${pkg}`);
      } catch (error) {
        console.warn(`⚠️ Could not verify installation of ${pkg}`);
        failedPackages.push(pkg);
      }
    }

    if (failedPackages.length > 0) {
      console.warn(`⚠️ Failed to verify installation of: ${failedPackages.join(', ')}`);
    }
  }

  /**
   * Map detected language features to required Babel packages
   */
  private mapFeatureToPackages(feature: DetectedFeature): string[] {
    const packageMap: Record<string, string[]> = {
      // Modern JavaScript features
      'optional-chaining': ['@babel/plugin-transform-optional-chaining'],
      'nullish-coalescing': ['@babel/plugin-transform-nullish-coalescing-operator'],
      'logical-assignment': ['@babel/plugin-transform-logical-assignment-operators'],
      'class-properties': ['@babel/plugin-proposal-class-properties'],
      'private-methods': ['@babel/plugin-proposal-private-methods'],
      'decorators': ['@babel/plugin-proposal-decorators'],
      'top-level-await': ['@babel/plugin-syntax-top-level-await'],
      
      // Framework support
      'jsx': ['@babel/preset-react'],
      'react': ['@babel/preset-react', '@babel/plugin-transform-react-jsx'],
      'solid': ['babel-preset-solid'],
      'vue': ['@vue/babel-preset-jsx'],
      
      // Language support
      'typescript': ['@babel/preset-typescript'],
      'flow': ['@babel/preset-flow'],
      
      // Async/Generator features
      'async-await': ['@babel/plugin-transform-async-to-generator'],
      'generators': ['@babel/plugin-transform-async-generator-functions'],
      'async-generators': ['@babel/plugin-transform-async-generator-functions'],
      
      // Object/Array features
      'object-rest-spread': ['@babel/plugin-proposal-object-rest-spread'],
      'destructuring': ['@babel/plugin-transform-destructuring'],
      
      // Module features
      'dynamic-import': ['@babel/plugin-syntax-dynamic-import'],
      'import-meta': ['@babel/plugin-syntax-import-meta'],
      'export-default-from': ['@babel/plugin-proposal-export-default-from'],
      'export-namespace-from': ['@babel/plugin-proposal-export-namespace-from'],
      
      // Advanced features
      'pipeline-operator': ['@babel/plugin-proposal-pipeline-operator'],
      'partial-application': ['@babel/plugin-proposal-partial-application'],
      'do-expressions': ['@babel/plugin-proposal-do-expressions'],
      'function-bind': ['@babel/plugin-proposal-function-bind'],
      
      // Runtime features
      'runtime-helpers': ['@babel/plugin-transform-runtime'],
      'regenerator': ['@babel/plugin-transform-regenerator'],
      'polyfills': ['@babel/plugin-transform-runtime', 'core-js']
    };

    return packageMap[feature.name] || [];
  }

  /**
   * Get optimized npm configuration for WebContainer environment
   */
  private getOptimizedNpmConfig(): Record<string, string> {
    return {
      NODE_ENV: 'development',
      NPM_CONFIG_PROGRESS: 'false',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_FUND: 'false',
      NPM_CONFIG_LOGLEVEL: 'error',
      NPM_CONFIG_PREFER_OFFLINE: 'true',
      NPM_CONFIG_CACHE_MAX: '86400000', // 24 hours
      NPM_CONFIG_PACKAGE_LOCK: 'true',
      NPM_CONFIG_SAVE_EXACT: 'false',
      NPM_CONFIG_ENGINE_STRICT: 'false'
    };
  }

  /**
   * Create environment-specific package.json optimizations
   */
  private createEnvironmentOptimizations(
    targetEnvironment: string,
    optimizeForDevelopment: boolean
  ): Partial<PackageJsonTemplate> {
    const optimizations: Partial<PackageJsonTemplate> = {};

    // Add environment-specific configurations
    switch (targetEnvironment) {
      case 'browser':
        optimizations.browserslist = [
          'last 2 Chrome versions',
          'last 2 Firefox versions',
          'last 2 Safari versions',
          'last 2 Edge versions'
        ];
        break;
        
      case 'node':
        optimizations.engines = {
          node: '>=18.0.0'
        };
        break;
        
      case 'universal':
        optimizations.browserslist = {
          production: ['> 1%', 'not dead'],
          development: ['last 1 Chrome version', 'last 1 Firefox version']
        };
        optimizations.engines = {
          node: '>=18.0.0'
        };
        break;
    }

    // Add development optimizations
    if (optimizeForDevelopment) {
      optimizations.sideEffects = false;
      
      // Add development-specific scripts
      const devScripts = {
        'dev:watch': 'babel src --out-dir dist --watch',
        'dev:debug': 'babel src --out-dir dist --source-maps',
        'analyze': 'babel src --out-dir dist --verbose'
      };
      
      optimizations.scripts = {
        ...optimizations.scripts,
        ...devScripts
      };
    }

    return optimizations;
  }

  /**
   * Detect and install framework-specific dependencies
   */
  async installFrameworkDependencies(framework: string): Promise<InstallationResult> {
    const frameworkPackages: Record<string, string[]> = {
      'react': [
        '@babel/preset-react',
        '@babel/plugin-transform-react-jsx',
        '@babel/plugin-transform-react-jsx-development',
        '@babel/plugin-transform-react-display-name'
      ],
      'solid': [
        'babel-preset-solid',
        '@babel/plugin-syntax-jsx'
      ],
      'vue': [
        '@vue/babel-preset-jsx',
        '@babel/plugin-syntax-jsx'
      ],
      'svelte': [
        '@babel/plugin-syntax-jsx',
        'babel-plugin-svelte'
      ]
    };

    const packages = frameworkPackages[framework] || [];
    
    if (packages.length === 0) {
      return {
        success: true,
        installedPackages: [],
        skippedPackages: [],
        errors: [`Unknown framework: ${framework}`]
      };
    }

    const detectedFeatures: DetectedFeature[] = packages.map(pkg => ({
      name: pkg,
      type: 'framework',
      confidence: 1.0
    }));

    return this.installDetectedDependencies(detectedFeatures);
  }

  /**
   * Create WebContainer-specific environment variables
   */
  async createEnvironmentVariables(): Promise<void> {
    const envContent = `# WebContainer Environment Variables
NODE_ENV=development
NODE_OPTIONS=--experimental-modules --experimental-json-modules
BABEL_ENV=development
FORCE_COLOR=1
NPM_CONFIG_PROGRESS=false
NPM_CONFIG_AUDIT=false
NPM_CONFIG_FUND=false
`;

    await this.container.fs.writeFile('/.env', envContent);
    console.log('✅ Created WebContainer environment variables');
  }

  /**
   * Setup WebContainer-specific optimizations
   */
  async setupWebContainerOptimizations(): Promise<void> {
    // Create optimized .gitignore
    const gitignoreContent = `# WebContainer optimizations
node_modules/
dist/
.cache/
.babel-cache/
*.log
.env.local
.DS_Store
Thumbs.db
`;

    await this.container.fs.writeFile('/.gitignore', gitignoreContent);

    // Create WebContainer-specific README
    const readmeContent = `# OrbisJS WebContainer Project

This project is optimized for WebContainer execution with modern Babel support.

## Features
- Modern JavaScript/TypeScript transpilation
- Automatic dependency management
- Framework support (React, Solid, Vue)
- Optimized for development workflow

## Scripts
- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run test\` - Run tests

## Configuration
Babel configuration is managed automatically based on detected language features.
`;

    await this.container.fs.writeFile('/README.md', readmeContent);

    console.log('✅ Setup WebContainer optimizations');
  }
}