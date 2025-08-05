/**
 * Unit tests for ModernBabelTransformer
 * Tests core transformation functionality with mocked dependencies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModernBabelTransformer } from '../ModernBabelTransformer.js';
import type { TransformOptions, BabelGlobalConfig } from '../types.js';

// Mock @babel/core
const mockBabelCore = {
  transformAsync: vi.fn(),
  transform: vi.fn()
};

// Mock dynamic imports - use vi.hoisted to ensure proper hoisting
vi.mock('@babel/core', async () => mockBabelCore);
vi.mock('@babel/preset-env', async () => ({ default: {} }));
vi.mock('@babel/preset-typescript', async () => ({ default: {} }));
vi.mock('@babel/preset-react', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-runtime', async () => ({ default: {} }));
vi.mock('@babel/plugin-proposal-class-properties', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-optional-chaining', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-nullish-coalescing-operator', async () => ({ default: {} }));

describe('ModernBabelTransformer', () => {
  let transformer: ModernBabelTransformer;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset singleton
    (ModernBabelTransformer as any).instance = null;
    transformer = ModernBabelTransformer.getInstance();
    
    // Mock successful Babel transformation
    mockBabelCore.transformAsync.mockResolvedValue({
      code: 'var x = 1;',
      map: null,
      ast: { type: 'Program', body: [] }
    });
  });

  afterEach(() => {
    transformer.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ModernBabelTransformer.getInstance();
      const instance2 = ModernBabelTransformer.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid Babel core', async () => {
      await transformer.initialize();
      expect(transformer.isInitialized()).toBe(true);
    });

    it('should throw error if @babel/core is not available', async () => {
      // Create a new transformer instance to test import failure
      const failingTransformer = new (ModernBabelTransformer as any)();
      
      // Mock the loadBabelCore method to throw an error
      vi.spyOn(failingTransformer, 'loadBabelCore').mockRejectedValue(new Error('Module not found'));

      await expect(failingTransformer.initialize()).rejects.toThrow('Failed to initialize Babel transformer');
    });

    it('should verify Babel functionality during initialization', async () => {
      await transformer.initialize();
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        'const x = 1;',
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-env'])
          ])
        })
      );
    });
  });

  describe('Core Transformation', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should transform JavaScript code successfully', async () => {
      const code = 'const x = 1;';
      const result = await transformer.transformCode(code);

      expect(result).toMatchObject({
        code: 'var x = 1;',
        metadata: expect.objectContaining({
          originalSize: code.length,
          transformedSize: 'var x = 1;'.length
        }),
        performance: expect.objectContaining({
          transformTime: expect.any(Number),
          cacheHit: false
        })
      });
    });

    it('should use cache for repeated transformations', async () => {
      const code = 'const x = 1;';
      
      // First transformation
      const result1 = await transformer.transformCode(code);
      expect(result1.performance.cacheHit).toBe(false);
      
      // Second transformation should hit cache
      const result2 = await transformer.transformCode(code);
      expect(result2.performance.cacheHit).toBe(true);
    });

    it('should handle transformation errors gracefully', async () => {
      mockBabelCore.transformAsync.mockRejectedValue(new Error('Syntax error'));
      
      const code = 'invalid syntax {';
      await expect(transformer.transformCode(code)).rejects.toThrow('Syntax error');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedTransformer = new (ModernBabelTransformer as any)();
      
      await expect(uninitializedTransformer.transformCode('const x = 1;'))
        .rejects.toThrow('Babel transformer not initialized');
    });
  });

  describe('Language-Specific Transformations', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should transform JavaScript with specific configuration', async () => {
      const code = 'const x = 1;';
      const config = {
        preset: 'env' as const,
        targets: { node: '16' },
        modules: 'commonjs' as const
      };

      await transformer.transformJavaScript(code, config);

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-env', expect.objectContaining({
              targets: { node: '16' },
              modules: 'commonjs'
            })])
          ])
        })
      );
    });

    it('should transform TypeScript code', async () => {
      const code = 'const x: number = 1;';
      const config = {
        allowNamespaces: true,
        isTSX: false
      };

      await transformer.transformTypeScript(code, config);

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-typescript', expect.objectContaining({
              allowNamespaces: true,
              isTSX: false
            })])
          ])
        })
      );
    });

    it('should transform JSX for React', async () => {
      const code = '<div>Hello World</div>';
      
      await transformer.transformJSX(code, 'react');

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-react', expect.objectContaining({
              runtime: 'automatic',
              importSource: 'react'
            })])
          ])
        })
      );
    });

    it('should transform JSX for Solid', async () => {
      const code = '<div>Hello World</div>';
      
      await transformer.transformJSX(code, 'solid');

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['babel-preset-solid'])
          ])
        })
      );
    });

    it('should transform JSX for Vue', async () => {
      const code = '<div>Hello World</div>';
      
      await transformer.transformJSX(code, 'vue');

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@vue/babel-preset-jsx'])
          ])
        })
      );
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should set and get global configuration', () => {
      const config: BabelGlobalConfig = {
        presets: [{
          name: '@babel/preset-env',
          options: { targets: { node: '16' } },
          enabled: true,
          order: 0
        }],
        plugins: [],
        targets: { node: '16' },
        sourceType: 'module',
        assumptions: {},
        parserOpts: { strictMode: true },
        generatorOpts: { compact: false },
        env: {}
      };

      transformer.setGlobalConfig(config);
      const retrievedConfig = transformer.getActiveConfig();
      
      expect(retrievedConfig).toEqual(config);
    });

    it('should validate configuration correctly', () => {
      const validConfig: BabelGlobalConfig = {
        presets: [],
        plugins: [],
        targets: {},
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      };

      const result = transformer.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        presets: 'not-an-array',
        plugins: null
      } as any;

      const result = transformer.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should clear cache when configuration changes', async () => {
      const code = 'const x = 1;';
      
      // Transform to populate cache
      await transformer.transformCode(code);
      expect(transformer.getCacheStats().totalEntries).toBe(1);
      
      // Change config should clear cache
      transformer.setGlobalConfig({
        presets: [],
        plugins: [],
        targets: {},
        sourceType: 'script',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      });
      
      expect(transformer.getCacheStats().totalEntries).toBe(0);
    });
  });

  describe('Plugin and Preset Management', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should register and retrieve presets', () => {
      const customPreset = { name: 'custom-preset' };
      transformer.registerPreset('custom-preset', customPreset);
      
      const presets = transformer.getAvailablePresets();
      expect(presets.some(p => p.name === 'custom-preset')).toBe(true);
    });

    it('should register and retrieve plugins', () => {
      const customPlugin = { name: 'custom-plugin' };
      transformer.registerPlugin('custom-plugin', customPlugin);
      
      const plugins = transformer.getAvailablePlugins();
      expect(plugins.some(p => p.name === 'custom-plugin')).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should provide cache statistics', async () => {
      const code = 'const x = 1;';
      await transformer.transformCode(code);
      
      const stats = transformer.getCacheStats();
      expect(stats).toMatchObject({
        totalEntries: 1,
        totalSize: expect.any(Number),
        hitRate: expect.any(Number),
        missRate: expect.any(Number),
        averageTransformTime: expect.any(Number),
        cacheEfficiency: expect.any(Number)
      });
    });

    it('should clear cache on demand', async () => {
      const code = 'const x = 1;';
      await transformer.transformCode(code);
      
      expect(transformer.getCacheStats().totalEntries).toBe(1);
      
      transformer.clearCache();
      expect(transformer.getCacheStats().totalEntries).toBe(0);
    });

    it('should enable/disable source maps', async () => {
      transformer.enableSourceMaps(false);
      
      const code = 'const x = 1;';
      await transformer.transformCode(code, { sourceMaps: true });
      
      // Should respect global setting over option
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          sourceMaps: false
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should create detailed transformation errors', async () => {
      const syntaxError = new Error('Unexpected token');
      (syntaxError as any).loc = { line: 1, column: 5 };
      
      mockBabelCore.transformAsync.mockRejectedValue(syntaxError);
      
      try {
        await transformer.transformCode('invalid {', { filename: 'test.js' });
      } catch (error: any) {
        expect(error.name).toBe('TransformationError');
        expect(error.type).toBe('syntax');
        expect(error.line).toBe(1);
        expect(error.column).toBe(5);
        expect(error.filename).toBe('test.js');
        expect(error.suggestions).toHaveLength(1);
      }
    });

    it('should handle missing Babel core gracefully', async () => {
      const transformer = new (ModernBabelTransformer as any)();
      
      await expect(transformer.transformCode('const x = 1;'))
        .rejects.toThrow('Babel transformer not initialized');
    });
  });

  describe('Transform Options', () => {
    beforeEach(async () => {
      await transformer.initialize();
    });

    it('should handle custom transform options', async () => {
      const code = 'const x = 1;';
      const options: TransformOptions = {
        filename: 'test.js',
        language: 'javascript',
        target: 'browser',
        sourceMaps: true,
        minify: true
      };

      await transformer.transformCode(code, options);

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          filename: 'test.js',
          sourceMaps: true,
          generatorOpts: expect.objectContaining({
            minified: true
          })
        })
      );
    });

    it('should use custom configuration when provided', async () => {
      const code = 'const x = 1;';
      const customConfig = {
        presets: [{
          name: '@babel/preset-env',
          options: { targets: { chrome: '90' } },
          enabled: true,
          order: 0
        }],
        plugins: []
      };

      await transformer.transformCode(code, { customConfig });

      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: [['@babel/preset-env', { targets: { chrome: '90' } }]]
        })
      );
    });
  });

  describe('Lifecycle Management', () => {
    it('should properly destroy instance', async () => {
      await transformer.initialize();
      
      // Add some cache entries
      await transformer.transformCode('const x = 1;');
      expect(transformer.getCacheStats().totalEntries).toBe(1);
      
      transformer.destroy();
      
      expect(transformer.isInitialized()).toBe(false);
      expect(transformer.getCacheStats().totalEntries).toBe(0);
    });
  });
});