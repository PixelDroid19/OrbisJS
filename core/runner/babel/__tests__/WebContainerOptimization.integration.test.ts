/**
 * Integration tests for WebContainer optimization and environment setup
 * Tests the complete WebContainer initialization and optimization pipeline
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { WebContainerInitializer, type InitializationOptions, type InitializationResult } from '../WebContainerInitializer.js';
import { WebContainerPackageManager, type WebContainerInitOptions } from '../WebContainerPackageManager.js';
import type { WebContainerInstance } from '../../types.js';

// Mock WebContainer instance with comprehensive functionality
const createMockWebContainer = (): WebContainerInstance => {
  const mockFs = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined)
  };

  const mockSpawn = vi.fn().mockResolvedValue({
    exit: Promise.resolve(0),
    kill: vi.fn()
  });

  return {
    fs: mockFs,
    spawn: mockSpawn
  } as any;
};

describe('WebContainer Optimization Integration', () => {
  let mockContainer: WebContainerInstance;
  let initializer: WebContainerInitializer;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    initializer = new WebContainerInitializer(mockContainer);
    vi.clearAllMocks();
  });

  describe('Complete Initialization Pipeline', () => {
    it('should successfully initialize WebContainer with modern Babel ecosystem', async () => {
      const options: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        createBabelRC: true,
        createBabelConfigJS: false,
        timeout: 30000
      };

      // Mock successful package.json creation and reading
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockImplementation((path: string) => {
          if (path === '/package.json') {
            return Promise.resolve(JSON.stringify({
              name: 'orbisjs-webcontainer-project',
              version: '1.0.0',
              type: 'module',
              babel: {},
              devDependencies: { '@babel/core': '^7.24.0' }
            }));
          }
          if (path === '/.babelrc' || path === '/babel.config.js') {
            return Promise.resolve('{}');
          }
          if (path.includes('/node_modules/')) {
            return Promise.resolve('{}');
          }
          return Promise.reject(new Error('File not found'));
        });

      // Mock successful dependency installation
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }) // npm install
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }); // node --version

      // Mock node_modules directory
      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'core-js', 'regenerator-runtime']);

      const result: InitializationResult = await initializer.initialize(options);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.projectType).toBe('javascript');

      // Verify package.json was created
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/package.json',
        expect.stringContaining('"name": "orbisjs-webcontainer-project"')
      );

      // Verify Node.js optimization files were created
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/.node-version', '18.19.0');
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/.npmrc', expect.stringContaining('progress=false'));
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/node-startup.js', expect.stringContaining('Node.js optimized'));

      // Verify Babel configuration was created
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.babelrc',
        expect.stringContaining('@babel/preset-env')
      );
    });

    it('should handle TypeScript project initialization', async () => {
      const options: InitializationOptions = {
        projectType: 'typescript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        createBabelConfigJS: true
      };

      // Mock successful initialization
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockImplementation((path: string) => {
          if (path === '/package.json') {
            return Promise.resolve(JSON.stringify({
              name: 'test',
              version: '1.0.0',
              babel: {},
              devDependencies: { '@babel/core': '^7.24.0' }
            }));
          }
          if (path === '/babel.config.js' || path === '/.babelrc') {
            return Promise.resolve('{}');
          }
          if (path.includes('/node_modules/')) {
            return Promise.resolve('{}');
          }
          return Promise.reject(new Error('File not found'));
        });

      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'typescript']);

      const result = await initializer.initialize(options);

      expect(result.success).toBe(true);
      expect(result.projectType).toBe('typescript');

      // Verify TypeScript-specific Babel configuration
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/babel.config.js',
        expect.stringContaining('@babel/preset-typescript')
      );
    });

    it('should handle React project initialization with JSX support', async () => {
      const options: InitializationOptions = {
        projectType: 'react',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        createBabelRC: true
      };

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockImplementation((path: string) => {
          if (path === '/package.json') {
            return Promise.resolve(JSON.stringify({
              name: 'test',
              version: '1.0.0',
              babel: {},
              devDependencies: { '@babel/core': '^7.24.0' }
            }));
          }
          if (path === '/babel.config.js' || path === '/.babelrc') {
            return Promise.resolve('{}');
          }
          if (path.includes('/node_modules/')) {
            return Promise.resolve('{}');
          }
          return Promise.reject(new Error('File not found'));
        });

      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'react']);

      const result = await initializer.initialize(options);

      expect(result.success).toBe(true);

      // Verify React-specific configuration
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.babelrc',
        expect.stringContaining('@babel/preset-react')
      );
    });

    it('should skip dependency installation when requested', async () => {
      const options: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: false,
        skipDependencyInstall: true
      };

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockImplementation((path: string) => {
          if (path === '/package.json') {
            return Promise.resolve(JSON.stringify({
              name: 'test',
              version: '1.0.0',
              babel: {},
              devDependencies: { '@babel/core': '^7.24.0' }
            }));
          }
          if (path === '/babel.config.js' || path === '/.babelrc') {
            return Promise.resolve('{}');
          }
          if (path.includes('/node_modules/')) {
            return Promise.resolve('{}');
          }
          return Promise.reject(new Error('File not found'));
        });

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue([]);

      const result = await initializer.initialize(options);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dependency installation was skipped');

      // Verify npm install was not called
      expect(mockContainer.spawn).not.toHaveBeenCalledWith('npm', expect.arrayContaining(['install']));
    });

    it('should handle initialization failures gracefully', async () => {
      const options: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true
      };

      // Mock package.json creation failure
      (mockContainer.fs.writeFile as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('File system error'));

      const result = await initializer.initialize(options);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Package.json creation failed');
    });

    it('should handle dependency installation timeout', async () => {
      const options: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        timeout: 100 // Very short timeout
      };

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockImplementation((path: string) => {
          if (path === '/package.json') {
            return Promise.resolve(JSON.stringify({
              name: 'test',
              version: '1.0.0',
              babel: {},
              devDependencies: { '@babel/core': '^7.24.0' }
            }));
          }
          if (path === '/babel.config.js' || path === '/.babelrc') {
            return Promise.resolve('{}');
          }
          if (path.includes('/node_modules/')) {
            return Promise.resolve('{}');
          }
          return Promise.reject(new Error('File not found'));
        });

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'other-package']);

      // Mock slow npm install that exceeds timeout
      (mockContainer.spawn as MockedFunction<any>)
        .mockImplementationOnce(() => {
          const mockProcess = {
            exit: new Promise(resolve => {
              setTimeout(() => resolve(0), 200); // Longer than timeout
            }),
            kill: vi.fn()
          };
          return Promise.resolve(mockProcess);
        });

      const result = await initializer.initialize(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('timeout'))).toBe(true);
    });
  });

  describe('Environment Validation', () => {
    it('should validate complete WebContainer environment', async () => {
      const options: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true
      };

      // Mock successful environment
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce(JSON.stringify({ name: 'test', version: '1.0.0' })) // package.json
        .mockResolvedValueOnce('{}') // babel.config.js
        .mockResolvedValueOnce('{}') // @babel/core/package.json
        .mockResolvedValueOnce('{}'); // @babel/preset-env/package.json

      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'other-package']);

      await initializer.initialize(options);

      const status = await initializer.getInitializationStatus();

      expect(status.hasPackageJson).toBe(true);
      expect(status.hasNodeModules).toBe(true);
      expect(status.hasBabelConfig).toBe(true);
      expect(status.installedPackages).toBe(2);
    });

    it('should detect missing components in environment', async () => {
      // Mock file system to return file not found errors
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockRejectedValue(new Error('File not found'));

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockRejectedValue(new Error('Directory not found'));

      const status = await initializer.getInitializationStatus();

      expect(status.hasPackageJson).toBe(false);
      expect(status.hasNodeModules).toBe(false);
      expect(status.hasBabelConfig).toBe(false);
      expect(status.installedPackages).toBe(0);
    });
  });

  describe('Cleanup and Reset', () => {
    it('should clean up WebContainer environment completely', async () => {
      await initializer.cleanup();

      // Verify all files are removed
      const expectedFiles = [
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

      expectedFiles.forEach(file => {
        expect(mockContainer.fs.rm).toHaveBeenCalledWith(file);
      });

      // Verify node_modules directory is removed
      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/node_modules', { recursive: true });
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock the first file removal to fail
      (mockContainer.fs.rm as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValue(undefined); // Other removals succeed

      await expect(initializer.cleanup()).rejects.toThrow('Permission denied');
    });
  });

  describe('Module System Support', () => {
    it('should configure ESM module system correctly', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        moduleSystem: 'esm',
        targetEnvironment: 'browser'
      };

      const packageJson = await packageManager.createPackageJson(options);

      expect(packageJson.type).toBe('module');
      expect(packageJson.exports).toEqual({
        '.': {
          import: './index.js',
          types: './index.d.ts'
        },
        './package.json': './package.json'
      });

      // Verify ESM-specific Babel configuration
      expect(packageJson.babel?.presets).toBeDefined();
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].modules).toBe(false);
    });

    it('should configure CommonJS module system correctly', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'node',
        enableESModules: false,
        nodeVersion: '18.19.0',
        installDependencies: true,
        moduleSystem: 'commonjs',
        targetEnvironment: 'node'
      };

      const packageJson = await packageManager.createPackageJson(options);

      expect(packageJson.type).toBe('commonjs');
      expect(packageJson.exports).toBe('./index.js');

      // Verify CommonJS-specific Babel configuration
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].modules).toBe('commonjs');
    });

    it('should auto-detect module system when set to auto', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        moduleSystem: 'auto',
        targetEnvironment: 'universal'
      };

      const packageJson = await packageManager.createPackageJson(options);

      expect(packageJson.type).toBe('module'); // Should default to module when ESM is enabled
      
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].modules).toBe('auto');
    });
  });

  describe('Target Environment Optimization', () => {
    it('should optimize for browser environment', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        targetEnvironment: 'browser',
        optimizeForDevelopment: true
      };

      const packageJson = await packageManager.createPackageJson(options);

      // Should include browser-specific dependencies
      expect(packageJson.dependencies).toHaveProperty('core-js');
      expect(packageJson.dependencies).toHaveProperty('regenerator-runtime');
      expect(packageJson.dependencies).toHaveProperty('source-map-support');

      // Should have browser-specific browserslist
      expect(packageJson.browserslist).toEqual([
        'last 2 Chrome versions',
        'last 2 Firefox versions',
        'last 2 Safari versions',
        'last 2 Edge versions'
      ]);

      // Should configure Babel for browser usage
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].useBuiltIns).toBe('usage');
      expect(envPreset?.[1].corejs).toBe(3);
    });

    it('should optimize for Node.js environment', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'node',
        enableESModules: false,
        nodeVersion: '18.19.0',
        installDependencies: true,
        targetEnvironment: 'node',
        optimizeForDevelopment: false
      };

      const packageJson = await packageManager.createPackageJson(options);

      // Should not include browser-specific dependencies
      expect(packageJson.dependencies).not.toHaveProperty('core-js');
      expect(packageJson.dependencies).not.toHaveProperty('regenerator-runtime');

      // Should have Node.js-specific browserslist
      expect(packageJson.browserslist).toEqual([`node ${process.version.slice(1)}`]);

      // Should configure Babel for Node.js
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].targets).toEqual({ node: '18' });
      expect(envPreset?.[1].modules).toBe('commonjs');
    });

    it('should optimize for universal environment', async () => {
      const packageManager = new WebContainerPackageManager(mockContainer);
      
      const options: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18.19.0',
        installDependencies: true,
        targetEnvironment: 'universal'
      };

      const packageJson = await packageManager.createPackageJson(options);

      // Should include browser dependencies for universal support
      expect(packageJson.dependencies).toHaveProperty('core-js');
      expect(packageJson.dependencies).toHaveProperty('regenerator-runtime');

      // Should have universal browserslist
      expect(packageJson.browserslist).toEqual({
        production: ['> 1%', 'not dead'],
        development: ['last 1 Chrome version', 'last 1 Firefox version']
      });

      // Should configure Babel for universal usage
      const envPreset = packageJson.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset?.[1].targets).toEqual({
        node: '18',
        browsers: ['last 2 versions']
      });
    });
  });
});