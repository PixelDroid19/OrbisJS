/**
 * Unit tests for WebContainer Package Manager
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { WebContainerPackageManager, type WebContainerInitOptions } from '../WebContainerPackageManager.js';
import type { WebContainerInstance } from '../../types.js';

// Mock WebContainer instance
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

describe('WebContainerPackageManager', () => {
  let mockContainer: WebContainerInstance;
  let packageManager: WebContainerPackageManager;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    packageManager = new WebContainerPackageManager(mockContainer);
    vi.clearAllMocks();
  });

  describe('createPackageJson', () => {
    const defaultOptions: WebContainerInitOptions = {
      projectType: 'javascript',
      enableESModules: true,
      nodeVersion: '18',
      installDependencies: true
    };

    it('should create package.json with correct basic structure', async () => {
      const result = await packageManager.createPackageJson(defaultOptions);

      expect(result).toMatchObject({
        name: 'orbisjs-webcontainer-project',
        version: '1.0.0',
        type: 'module',
        engines: { node: '18' }
      });

      expect(result.scripts).toBeDefined();
      expect(result.dependencies).toBeDefined();
      expect(result.devDependencies).toBeDefined();
      expect(result.babel).toBeDefined();
    });

    it('should write package.json to WebContainer filesystem', async () => {
      await packageManager.createPackageJson(defaultOptions);

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/package.json',
        expect.stringContaining('"name": "orbisjs-webcontainer-project"')
      );
    });

    it('should configure ESM when enableESModules is true', async () => {
      const result = await packageManager.createPackageJson({
        ...defaultOptions,
        enableESModules: true
      });

      expect(result.type).toBe('module');
      expect(result.scripts.dev).toContain('--experimental-modules');
    });

    it('should configure CommonJS when enableESModules is false', async () => {
      const result = await packageManager.createPackageJson({
        ...defaultOptions,
        enableESModules: false
      });

      expect(result.type).toBe('commonjs');
      expect(result.scripts.dev).not.toContain('--experimental-modules');
    });

    it('should include correct dependencies for JavaScript project', async () => {
      const result = await packageManager.createPackageJson({
        ...defaultOptions,
        projectType: 'javascript'
      });

      expect(result.dependencies).toHaveProperty('@babel/runtime');
      expect(result.devDependencies).toHaveProperty('@babel/core');
      expect(result.devDependencies).toHaveProperty('@babel/preset-env');
      expect(result.devDependencies).not.toHaveProperty('@babel/preset-react');
    });

    it('should include React dependencies for React project', async () => {
      const result = await packageManager.createPackageJson({
        ...defaultOptions,
        projectType: 'react'
      });

      expect(result.devDependencies).toHaveProperty('@babel/preset-react');
      expect(result.devDependencies).toHaveProperty('@babel/plugin-transform-react-jsx-development');
    });

    it('should include TypeScript dependencies for TypeScript project', async () => {
      const result = await packageManager.createPackageJson({
        ...defaultOptions,
        projectType: 'typescript'
      });

      expect(result.devDependencies).toHaveProperty('@babel/preset-typescript');
      expect(result.devDependencies).toHaveProperty('@babel/plugin-proposal-decorators');
    });

    it('should create appropriate scripts for different project types', async () => {
      const reactResult = await packageManager.createPackageJson({
        ...defaultOptions,
        projectType: 'react'
      });

      expect(reactResult.scripts).toHaveProperty('build:react');
      expect(reactResult.scripts).toHaveProperty('dev:react');

      const tsResult = await packageManager.createPackageJson({
        ...defaultOptions,
        projectType: 'typescript'
      });

      expect(tsResult.scripts).toHaveProperty('build:ts');
      expect(tsResult.scripts).toHaveProperty('type-check');
    });
  });

  describe('installDependencies', () => {
    it('should spawn npm install process', async () => {
      await packageManager.installDependencies();

      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', ['install'], {
        env: {
          NODE_ENV: 'development',
          NPM_CONFIG_PROGRESS: 'false',
          NPM_CONFIG_AUDIT: 'false',
          NPM_CONFIG_FUND: 'false'
        }
      });
    });

    it('should handle successful installation', async () => {
      const mockProcess = {
        exit: Promise.resolve(0),
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockProcess);

      // Mock dependency verification
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');

      await expect(packageManager.installDependencies()).resolves.not.toThrow();
    });

    it('should handle installation failure', async () => {
      const mockProcess = {
        exit: Promise.resolve(1),
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockProcess);

      await expect(packageManager.installDependencies()).rejects.toThrow('npm install failed');
    });

    it('should handle installation timeout', async () => {
      const mockProcess = {
        exit: new Promise(() => {}), // Never resolves
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockProcess);

      await expect(
        packageManager.installDependencies({ timeout: 100 })
      ).rejects.toThrow('timeout');
    });

    it('should verify critical dependencies after installation', async () => {
      const mockProcess = {
        exit: Promise.resolve(0),
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockProcess);
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');

      await packageManager.installDependencies();

      // Should check for critical dependencies
      expect(mockContainer.fs.readFile).toHaveBeenCalledWith(
        '/node_modules/@babel/core/package.json',
        'utf-8'
      );
      expect(mockContainer.fs.readFile).toHaveBeenCalledWith(
        '/node_modules/@babel/preset-env/package.json',
        'utf-8'
      );
    });
  });

  describe('createBabelRC', () => {
    it('should create .babelrc file with correct configuration', async () => {
      await packageManager.createBabelRC('javascript');

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.babelrc',
        expect.stringContaining('@babel/preset-env')
      );
    });

    it('should create different configurations for different project types', async () => {
      await packageManager.createBabelRC('react');

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.babelrc',
        expect.stringContaining('@babel/preset-react')
      );
    });
  });

  describe('createBabelConfigJS', () => {
    it('should create babel.config.js file', async () => {
      await packageManager.createBabelConfigJS('javascript');

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/babel.config.js',
        expect.stringContaining('module.exports =')
      );
    });
  });

  describe('initializeNodeEnvironment', () => {
    it('should create Node.js environment files', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>).mockRejectedValue(new Error('File not found'));

      await packageManager.initializeNodeEnvironment();

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/.nvmrc', '18');
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/index.js',
        expect.stringContaining('WebContainer initialized')
      );
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/setup-env.sh',
        expect.stringContaining('NODE_OPTIONS')
      );
    });

    it('should not overwrite existing index.js', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('existing content');

      await packageManager.initializeNodeEnvironment();

      // Should not write index.js if it already exists
      expect(mockContainer.fs.writeFile).not.toHaveBeenCalledWith(
        '/index.js',
        expect.any(String)
      );
    });
  });

  describe('getPackageJson', () => {
    it('should return parsed package.json content', async () => {
      const mockPackageJson = {
        name: 'test-project',
        version: '1.0.0'
      };
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue(
        JSON.stringify(mockPackageJson)
      );

      const result = await packageManager.getPackageJson();

      expect(result).toEqual(mockPackageJson);
    });

    it('should return null if package.json does not exist', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>).mockRejectedValue(
        new Error('File not found')
      );

      const result = await packageManager.getPackageJson();

      expect(result).toBeNull();
    });
  });

  describe('updatePackageJson', () => {
    it('should merge updates with existing package.json', async () => {
      const existingPackageJson = {
        name: 'existing-project',
        version: '1.0.0',
        dependencies: { 'existing-dep': '1.0.0' },
        devDependencies: { 'existing-dev-dep': '1.0.0' }
      };

      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue(
        JSON.stringify(existingPackageJson)
      );

      const updates = {
        version: '2.0.0',
        dependencies: { 'new-dep': '2.0.0' },
        devDependencies: { 'new-dev-dep': '2.0.0' }
      };

      await packageManager.updatePackageJson(updates);

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/package.json',
        expect.stringContaining('"version": "2.0.0"')
      );

      // Should preserve existing dependencies and add new ones
      const writtenContent = (mockContainer.fs.writeFile as MockedFunction<any>).mock.calls[0][1];
      const writtenPackageJson = JSON.parse(writtenContent);

      expect(writtenPackageJson.dependencies).toEqual({
        'existing-dep': '1.0.0',
        'new-dep': '2.0.0'
      });
      expect(writtenPackageJson.devDependencies).toEqual({
        'existing-dev-dep': '1.0.0',
        'new-dev-dep': '2.0.0'
      });
    });

    it('should throw error if no package.json exists', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>).mockRejectedValue(
        new Error('File not found')
      );

      await expect(
        packageManager.updatePackageJson({ version: '2.0.0' })
      ).rejects.toThrow('No package.json found to update');
    });
  });
});

describe('Package.json Template Validation', () => {
  let mockContainer: WebContainerInstance;
  let packageManager: WebContainerPackageManager;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    packageManager = new WebContainerPackageManager(mockContainer);
  });

  it('should generate valid package.json for all project types', async () => {
    const projectTypes = ['javascript', 'typescript', 'react', 'solid', 'vue', 'node'] as const;

    for (const projectType of projectTypes) {
      const options: WebContainerInitOptions = {
        projectType,
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true
      };

      const result = await packageManager.createPackageJson(options);

      // Basic validation
      expect(result.name).toBeTruthy();
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(['module', 'commonjs']).toContain(result.type);
      expect(result.engines?.node).toBeTruthy();

      // Scripts validation
      expect(result.scripts).toHaveProperty('dev');
      expect(result.scripts).toHaveProperty('build');
      expect(result.scripts).toHaveProperty('test');

      // Dependencies validation
      expect(result.dependencies).toHaveProperty('@babel/runtime');
      expect(result.devDependencies).toHaveProperty('@babel/core');
      expect(result.devDependencies).toHaveProperty('@babel/preset-env');

      // Babel configuration validation
      expect(result.babel).toBeDefined();
      expect(result.babel?.presets).toBeDefined();
      expect(result.babel?.plugins).toBeDefined();
    }
  });

  it('should have consistent dependency versions across project types', async () => {
    const projectTypes = ['javascript', 'typescript', 'react'] as const;
    const results = [];

    for (const projectType of projectTypes) {
      const options: WebContainerInitOptions = {
        projectType,
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true
      };

      const result = await packageManager.createPackageJson(options);
      results.push(result);
    }

    // Check that common dependencies have the same version across project types
    const commonDeps = ['@babel/core', '@babel/runtime', '@babel/preset-env'];

    for (const dep of commonDeps) {
      const versions = results.map(r => 
        r.dependencies[dep] || r.devDependencies[dep]
      ).filter(Boolean);

      // All versions should be the same
      expect(new Set(versions).size).toBe(1);
    }
  });
});