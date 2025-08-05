/**
 * Integration tests for WebContainer environment validation and health checking
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { WebContainerPackageManager, type WebContainerInitOptions, type DetectedFeature } from '../WebContainerPackageManager.js';
import type { WebContainerInstance } from '../../types.js';

// Mock WebContainer instance with enhanced functionality
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

describe('WebContainer Environment Validation', () => {
  let mockContainer: WebContainerInstance;
  let packageManager: WebContainerPackageManager;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    packageManager = new WebContainerPackageManager(mockContainer);
    vi.clearAllMocks();
  });

  describe('validateEnvironment', () => {
    it('should pass all checks for healthy environment', async () => {
      // Mock successful environment
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }) // node --version
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }); // npm --version

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce(JSON.stringify({ // package.json
          name: 'test-project',
          version: '1.0.0',
          babel: {},
          devDependencies: { '@babel/core': '^7.24.0' }
        }))
        .mockResolvedValueOnce('{}') // @babel/core/package.json
        .mockResolvedValueOnce('{}'); // @babel/preset-env/package.json

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'other-package']);

      const result = await packageManager.validateEnvironment();

      expect(result.isHealthy).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.checks).toHaveLength(7); // All checks should be present
      expect(result.checks.every(check => check.status === 'passed')).toBe(true);
    });

    it('should detect Node.js unavailability', async () => {
      (mockContainer.spawn as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('Node.js not found'));

      const result = await packageManager.validateEnvironment();

      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('Node.js is not available');
      
      const nodeCheck = result.checks.find(check => check.name === 'Node.js availability');
      expect(nodeCheck?.status).toBe('failed');
    });

    it('should detect missing critical dependencies', async () => {
      // Mock successful basic checks
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce(JSON.stringify({ name: 'test', version: '1.0.0' })) // package.json
        .mockRejectedValueOnce(new Error('File not found')) // @babel/core missing
        .mockRejectedValueOnce(new Error('File not found')); // @babel/preset-env missing

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue([]);

      const result = await packageManager.validateEnvironment();

      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('Critical dependency @babel/core is missing');
      expect(result.errors).toContain('Critical dependency @babel/preset-env is missing');
    });

    it('should handle file system permission issues', async () => {
      // Mock successful basic checks
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValue('{}');

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['package']);

      // Mock file system write failure
      (mockContainer.fs.writeFile as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const result = await packageManager.validateEnvironment();

      expect(result.isHealthy).toBe(false);
      expect(result.errors).toContain('File system is not writable');
      
      const fsCheck = result.checks.find(check => check.name === 'File system permissions');
      expect(fsCheck?.status).toBe('failed');
    });

    it('should provide warnings for non-critical issues', async () => {
      // Mock mostly successful environment with some warnings
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }) // node --version
        .mockResolvedValueOnce({ exit: Promise.resolve(1), kill: vi.fn() }); // npm --version fails

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce(JSON.stringify({ name: 'test' })) // package.json missing version
        .mockResolvedValueOnce('{}') // @babel/core
        .mockResolvedValueOnce('{}'); // @babel/preset-env

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue([]);

      const result = await packageManager.validateEnvironment();

      expect(result.isHealthy).toBe(true); // Still healthy despite warnings
      expect(result.warnings).toContain('npm may not be working properly');
      expect(result.warnings).toContain('package.json is missing required fields (name or version)');
      expect(result.warnings).toContain('No dependencies appear to be installed');
    });
  });

  describe('installDetectedDependencies', () => {
    it('should install packages for detected features', async () => {
      const detectedFeatures: DetectedFeature[] = [
        { name: 'optional-chaining', type: 'syntax', confidence: 0.9 },
        { name: 'jsx', type: 'framework', confidence: 0.8 },
        { name: 'typescript', type: 'syntax', confidence: 1.0 }
      ];

      // Mock current package.json without the required dependencies
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValue(JSON.stringify({
          name: 'test',
          dependencies: {},
          devDependencies: { '@babel/core': '^7.24.0' }
        }));

      // Mock successful npm install
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      const result = await packageManager.installDetectedDependencies(detectedFeatures);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toContain('@babel/plugin-transform-optional-chaining');
      expect(result.installedPackages).toContain('@babel/preset-react');
      expect(result.installedPackages).toContain('@babel/preset-typescript');
      expect(result.errors).toHaveLength(0);

      // Verify npm install was called with correct packages
      expect(mockContainer.spawn).toHaveBeenCalledWith('npm', [
        'install',
        '--save-dev',
        expect.stringContaining('@babel/plugin-transform-optional-chaining'),
        expect.stringContaining('@babel/preset-react'),
        expect.stringContaining('@babel/preset-typescript')
      ]);
    });

    it('should skip already installed packages', async () => {
      const detectedFeatures: DetectedFeature[] = [
        { name: 'optional-chaining', type: 'syntax', confidence: 0.9 }
      ];

      // Mock package.json with already installed dependency
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValue(JSON.stringify({
          name: 'test',
          dependencies: {},
          devDependencies: {
            '@babel/core': '^7.24.0',
            '@babel/plugin-transform-optional-chaining': '^7.24.0'
          }
        }));

      const result = await packageManager.installDetectedDependencies(detectedFeatures);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toHaveLength(0);
      expect(result.skippedPackages).toContain('@babel/plugin-transform-optional-chaining');
      expect(mockContainer.spawn).not.toHaveBeenCalled();
    });

    it('should handle installation failures gracefully', async () => {
      const detectedFeatures: DetectedFeature[] = [
        { name: 'optional-chaining', type: 'syntax', confidence: 0.9 }
      ];

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValue(JSON.stringify({
          name: 'test',
          dependencies: {},
          devDependencies: {}
        }));

      // Mock failed npm install
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(1), kill: vi.fn() });

      const result = await packageManager.installDetectedDependencies(detectedFeatures);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('npm install failed with exit code 1');
      expect(result.installedPackages).toHaveLength(0);
    });

    it('should handle no detected features', async () => {
      const result = await packageManager.installDetectedDependencies([]);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toHaveLength(0);
      expect(result.skippedPackages).toHaveLength(0);
      expect(mockContainer.spawn).not.toHaveBeenCalled();
    });

    it('should map various language features to correct packages', async () => {
      const detectedFeatures: DetectedFeature[] = [
        { name: 'class-properties', type: 'syntax', confidence: 0.9 },
        { name: 'decorators', type: 'syntax', confidence: 0.8 },
        { name: 'nullish-coalescing', type: 'syntax', confidence: 0.9 },
        { name: 'logical-assignment', type: 'syntax', confidence: 0.7 }
      ];

      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValue(JSON.stringify({
          name: 'test',
          dependencies: {},
          devDependencies: {}
        }));

      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValue({ exit: Promise.resolve(0), kill: vi.fn() });

      const result = await packageManager.installDetectedDependencies(detectedFeatures);

      expect(result.success).toBe(true);
      expect(result.installedPackages).toContain('@babel/plugin-proposal-class-properties');
      expect(result.installedPackages).toContain('@babel/plugin-proposal-decorators');
      expect(result.installedPackages).toContain('@babel/plugin-transform-nullish-coalescing-operator');
      expect(result.installedPackages).toContain('@babel/plugin-transform-logical-assignment-operators');
    });
  });

  describe('Enhanced Package.json Creation', () => {
    it('should create package.json with module system configuration', async () => {
      const options: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true,
        moduleSystem: 'esm',
        targetEnvironment: 'browser',
        optimizeForDevelopment: true
      };

      const result = await packageManager.createPackageJson(options);

      expect(result.type).toBe('module');
      expect(result.browserslist).toBeDefined();
      expect(result.exports).toBeDefined();
      expect(result.sideEffects).toBe(false);
      
      // Check browser-specific dependencies
      expect(result.dependencies).toHaveProperty('core-js');
      expect(result.dependencies).toHaveProperty('regenerator-runtime');
      expect(result.dependencies).toHaveProperty('source-map-support');
    });

    it('should create CommonJS configuration when specified', async () => {
      const options: WebContainerInitOptions = {
        projectType: 'node',
        enableESModules: false,
        nodeVersion: '18',
        installDependencies: true,
        moduleSystem: 'commonjs',
        targetEnvironment: 'node'
      };

      const result = await packageManager.createPackageJson(options);

      expect(result.type).toBe('commonjs');
      expect(result.exports).toBe('./index.js');
      
      // Should not have browser-specific dependencies
      expect(result.dependencies).not.toHaveProperty('core-js');
      expect(result.dependencies).not.toHaveProperty('regenerator-runtime');
    });

    it('should configure Babel for different target environments', async () => {
      const browserOptions: WebContainerInitOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true,
        targetEnvironment: 'browser'
      };

      const result = await packageManager.createPackageJson(browserOptions);

      expect(result.babel?.presets).toBeDefined();
      const envPreset = result.babel?.presets.find(preset => 
        Array.isArray(preset) && preset[0] === '@babel/preset-env'
      ) as [string, any] | undefined;

      expect(envPreset).toBeDefined();
      expect(envPreset?.[1].useBuiltIns).toBe('usage');
      expect(envPreset?.[1].corejs).toBe(3);
    });

    it('should add development optimizations when enabled', async () => {
      const options: WebContainerInitOptions = {
        projectType: 'typescript',
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true,
        optimizeForDevelopment: true
      };

      const result = await packageManager.createPackageJson(options);

      expect(result.devDependencies).toHaveProperty('@babel/plugin-transform-optional-chaining');
      expect(result.devDependencies).toHaveProperty('@babel/plugin-transform-nullish-coalescing-operator');
      expect(result.devDependencies).toHaveProperty('@babel/plugin-transform-logical-assignment-operators');
      expect(result.devDependencies).toHaveProperty('typescript');
    });
  });
});