/**
 * Unit tests for WebContainer Initializer
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { WebContainerInitializer, type InitializationOptions } from '../WebContainerInitializer.js';
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

describe('WebContainerInitializer', () => {
  let mockContainer: WebContainerInstance;
  let initializer: WebContainerInitializer;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    initializer = new WebContainerInitializer(mockContainer);
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    const defaultOptions: InitializationOptions = {
      projectType: 'javascript',
      enableESModules: true,
      nodeVersion: '18',
      installDependencies: true,
      createBabelRC: true,
      createBabelConfigJS: false,
      skipDependencyInstall: false,
      timeout: 30000
    };

    it('should complete successful initialization', async () => {
      // Mock successful dependency verification
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce('{}') // package.json read
        .mockResolvedValue('{}'); // dependency verification

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'other-package']);

      const result = await initializer.initialize(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.projectType).toBe('javascript');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.packageManager).toBeDefined();
    });

    it('should handle initialization failure gracefully', async () => {
      // Mock failure in package.json creation
      (mockContainer.fs.writeFile as MockedFunction<any>)
        .mockRejectedValue(new Error('Write failed'));

      const result = await initializer.initialize(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Package.json creation failed');
    });

    it('should skip dependency installation when requested', async () => {
      const options = { ...defaultOptions, skipDependencyInstall: true };

      // Mock successful operations except dependency install
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');
      (mockContainer.fs.readdir as MockedFunction<any>).mockResolvedValue([]);

      const result = await initializer.initialize(options);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Dependency installation was skipped');
      expect(mockContainer.spawn).not.toHaveBeenCalledWith('npm', ['install'], expect.any(Object));
    });

    it('should create Babel configuration files when requested', async () => {
      const options = {
        ...defaultOptions,
        createBabelRC: true,
        createBabelConfigJS: true,
        skipDependencyInstall: true
      };

      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');
      (mockContainer.fs.readdir as MockedFunction<any>).mockResolvedValue([]);

      await initializer.initialize(options);

      // Should create both .babelrc and babel.config.js
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.babelrc',
        expect.any(String)
      );
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/babel.config.js',
        expect.stringContaining('module.exports')
      );
    });

    it('should handle dependency installation timeout', async () => {
      const options = { ...defaultOptions, timeout: 100 };

      // Mock hanging npm install
      const mockProcess = {
        exit: new Promise(() => {}), // Never resolves
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockProcess);

      const result = await initializer.initialize(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('timeout'))).toBe(true);
    });

    it('should validate installation after completion', async () => {
      // Mock successful installation
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce('{"name": "test"}') // package.json
        .mockResolvedValueOnce('{}') // babel.config.js
        .mockResolvedValue('{}'); // dependency verification

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['@babel', 'other-package']);

      const mockVersionProcess = {
        exit: Promise.resolve(0),
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>)
        .mockResolvedValueOnce({ exit: Promise.resolve(0), kill: vi.fn() }) // npm install
        .mockResolvedValueOnce(mockVersionProcess); // node --version

      const result = await initializer.initialize(defaultOptions);

      expect(result.success).toBe(true);
      
      // Should have checked for package.json
      expect(mockContainer.fs.readFile).toHaveBeenCalledWith('/package.json', 'utf-8');
      
      // Should have checked node_modules
      expect(mockContainer.fs.readdir).toHaveBeenCalledWith('/node_modules');
      
      // Should have tested Node.js
      expect(mockContainer.spawn).toHaveBeenCalledWith('node', ['--version']);
    });
  });

  describe('getInitializationStatus', () => {
    it('should return correct status when fully initialized', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce('{"name": "test"}') // package.json
        .mockResolvedValueOnce('{}'); // babel.config.js

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue(['package1', 'package2', 'package3']);

      const mockVersionProcess = {
        exit: Promise.resolve(0),
        kill: vi.fn()
      };
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue(mockVersionProcess);

      const status = await initializer.getInitializationStatus();

      expect(status.hasPackageJson).toBe(true);
      expect(status.hasNodeModules).toBe(true);
      expect(status.hasBabelConfig).toBe(true);
      expect(status.installedPackages).toBe(3);
      expect(status.nodeVersion).toBe('18.x');
    });

    it('should return correct status when not initialized', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockRejectedValue(new Error('File not found'));
      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockRejectedValue(new Error('Directory not found'));
      (mockContainer.spawn as MockedFunction<any>)
        .mockRejectedValue(new Error('Node not found'));

      const status = await initializer.getInitializationStatus();

      expect(status.hasPackageJson).toBe(false);
      expect(status.hasNodeModules).toBe(false);
      expect(status.hasBabelConfig).toBe(false);
      expect(status.installedPackages).toBe(0);
      expect(status.nodeVersion).toBeUndefined();
    });

    it('should detect .babelrc when babel.config.js is not present', async () => {
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce('{"name": "test"}') // package.json
        .mockRejectedValueOnce(new Error('babel.config.js not found'))
        .mockResolvedValueOnce('{}'); // .babelrc

      (mockContainer.fs.readdir as MockedFunction<any>)
        .mockResolvedValue([]);

      const status = await initializer.getInitializationStatus();

      expect(status.hasBabelConfig).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove all initialization files', async () => {
      await initializer.cleanup();

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

      expect(mockContainer.fs.rm).toHaveBeenCalledWith('/node_modules', { recursive: true });
    });

    it('should handle cleanup errors gracefully', async () => {
      (mockContainer.fs.rm as MockedFunction<any>)
        .mockRejectedValue(new Error('File not found'));

      // Should not throw even if files don't exist
      await expect(initializer.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Node.js Environment Setup', () => {
    const defaultOptions: InitializationOptions = {
      projectType: 'javascript',
      enableESModules: true,
      nodeVersion: '18',
      installDependencies: true,
      createBabelRC: true,
      createBabelConfigJS: false,
      skipDependencyInstall: false,
      timeout: 30000
    };

    it('should create optimal Node.js configuration files', async () => {
      const options = { ...defaultOptions, skipDependencyInstall: true };
      
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockRejectedValueOnce(new Error('index.js not found')) // index.js doesn't exist
        .mockResolvedValue('{}'); // other files

      (mockContainer.fs.readdir as MockedFunction<any>).mockResolvedValue([]);

      await initializer.initialize(options);

      // Should create Node.js optimization files
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith('/.node-version', '18.19.0');
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/.npmrc',
        expect.stringContaining('progress=false')
      );
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        '/node-startup.js',
        expect.stringContaining('NODE_ENV')
      );
    });

    it('should not overwrite existing index.js', async () => {
      const options = { ...defaultOptions, skipDependencyInstall: true };
      
      (mockContainer.fs.readFile as MockedFunction<any>)
        .mockResolvedValueOnce('existing index.js content') // index.js exists
        .mockResolvedValue('{}'); // other files

      (mockContainer.fs.readdir as MockedFunction<any>).mockResolvedValue([]);

      await initializer.initialize(options);

      // Should not create index.js if it already exists
      expect(mockContainer.fs.writeFile).not.toHaveBeenCalledWith(
        '/index.js',
        expect.any(String)
      );
    });
  });

  describe('Error Handling', () => {
    const defaultOptions: InitializationOptions = {
      projectType: 'javascript',
      enableESModules: true,
      nodeVersion: '18',
      installDependencies: true,
      createBabelRC: true,
      createBabelConfigJS: false,
      skipDependencyInstall: false,
      timeout: 30000
    };

    it('should provide detailed error information', async () => {
      const specificError = new Error('Specific initialization error');
      (mockContainer.fs.writeFile as MockedFunction<any>).mockRejectedValue(specificError);

      const result = await initializer.initialize(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Package.json creation failed: Specific initialization error');
    });

    it('should handle unknown errors gracefully', async () => {
      (mockContainer.fs.writeFile as MockedFunction<any>).mockRejectedValue('string error');

      const result = await initializer.initialize(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('Unknown'))).toBe(true);
    });

    it('should continue with warnings when non-critical operations fail', async () => {
      // Mock successful core operations but failing validation
      (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');
      (mockContainer.fs.readdir as MockedFunction<any>).mockRejectedValue(new Error('readdir failed'));
      (mockContainer.spawn as MockedFunction<any>).mockResolvedValue({
        exit: Promise.resolve(0),
        kill: vi.fn()
      });

      const options = { ...defaultOptions, skipDependencyInstall: true };
      const result = await initializer.initialize(options);

      // Should still succeed despite validation warnings
      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Generation', () => {
    const defaultOptions: InitializationOptions = {
      projectType: 'javascript',
      enableESModules: true,
      nodeVersion: '18',
      installDependencies: true,
      createBabelRC: true,
      createBabelConfigJS: false,
      skipDependencyInstall: false,
      timeout: 30000
    };

    it('should generate project-specific Babel configurations', async () => {
      const projectTypes = ['javascript', 'typescript', 'react', 'solid', 'vue'] as const;

      for (const projectType of projectTypes) {
        vi.clearAllMocks(); // Clear mocks before each iteration
        
        const options = {
          ...defaultOptions,
          projectType,
          skipDependencyInstall: true
        };

        (mockContainer.fs.readFile as MockedFunction<any>).mockResolvedValue('{}');
        (mockContainer.fs.readdir as MockedFunction<any>).mockResolvedValue([]);

        await initializer.initialize(options);

        // Should create babel.config.js with project-specific content
        const babelConfigCall = (mockContainer.fs.writeFile as MockedFunction<unknown>).mock.calls
          .find(call => call[0] === '/babel.config.js');

        expect(babelConfigCall).toBeDefined();
        expect(babelConfigCall[1]).toContain(`// Babel Configuration for ${projectType} project`);
      }
    });
  });
});