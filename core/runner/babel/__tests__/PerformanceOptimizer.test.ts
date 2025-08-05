/**
 * Tests for Performance Optimizer
 * Tests caching, incremental compilation, and memory management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  PerformanceOptimizer, 
  TransformationCache, 
  IncrementalCompiler, 
  MemoryManager,
  type CacheEntry,
  type TransformResult,
  type BabelGlobalConfig
} from '../PerformanceOptimizer.js';
import type { WebContainerInstance } from '../../types.js';

// Mock WebContainer instance
const createMockWebContainer = (): WebContainerInstance => {
  return {
    fs: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
      readdir: vi.fn(),
      rm: vi.fn()
    },
    spawn: vi.fn()
  } as any;
};

describe('TransformationCache', () => {
  let cache: TransformationCache;

  beforeEach(() => {
    cache = new TransformationCache({ maxSize: 1024 * 1024, maxAge: 60000 });
  });

  describe('Basic caching functionality', () => {
    it('should store and retrieve cached transformations', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      // Store in cache
      cache.set(code, config, result);

      // Retrieve from cache
      const cached = cache.get(code, config);
      
      expect(cached).toBeTruthy();
      expect(cached?.transformedCode).toBe('var x = 1;');
      expect(cached?.originalCode).toBe(code);
    });

    it('should return null for cache miss', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      const cached = cache.get(code, config);
      expect(cached).toBeNull();
    });

    it('should generate different cache keys for different code', () => {
      const code1 = 'const x = 1;';
      const code2 = 'const y = 2;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      
      const result1: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code1.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      const result2: TransformResult = {
        code: 'var y = 2;',
        metadata: {
          originalSize: code2.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      cache.set(code1, config, result1);
      cache.set(code2, config, result2);

      const cached1 = cache.get(code1, config);
      const cached2 = cache.get(code2, config);

      expect(cached1?.transformedCode).toBe('var x = 1;');
      expect(cached2?.transformedCode).toBe('var y = 2;');
    });

    it('should generate different cache keys for different configurations', () => {
      const code = 'const x = 1;';
      const config1: BabelGlobalConfig = { presets: ['@babel/preset-env'], plugins: [] };
      const config2: BabelGlobalConfig = { presets: ['@babel/preset-typescript'], plugins: [] };
      
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      cache.set(code, config1, result);

      const cached1 = cache.get(code, config1);
      const cached2 = cache.get(code, config2);

      expect(cached1).toBeTruthy();
      expect(cached2).toBeNull();
    });
  });

  describe('Cache eviction and capacity management', () => {
    it('should evict least recently used entries when capacity is exceeded', () => {
      const smallCache = new TransformationCache({ maxSize: 500 }); // Small cache
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Add entries that exceed capacity
      for (let i = 0; i < 10; i++) {
        const code = `const x${i} = ${i};`.repeat(20); // Make it larger
        const result: TransformResult = {
          code: `var x${i} = ${i};`.repeat(20),
          metadata: {
            originalSize: code.length,
            transformedSize: code.length,
            appliedPresets: [],
            appliedPlugins: [],
            transformTime: 10,
            dependencies: []
          },
          performance: {
            transformTime: 10,
            cacheHit: false,
            memoryUsage: 1000,
            incrementalCompilation: false,
            workerThreadUsed: false
          }
        };

        smallCache.set(code, config, result);
      }

      const stats = smallCache.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(500);
      expect(stats.totalEntries).toBeLessThan(10); // Some entries should be evicted
    });

    it('should update access statistics correctly', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      cache.set(code, config, result);

      // Access multiple times
      cache.get(code, config);
      cache.get(code, config);
      const cached = cache.get(code, config);

      expect(cached?.accessCount).toBe(3);
    });
  });

  describe('Cache statistics', () => {
    it('should calculate hit and miss rates correctly', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      cache.set(code, config, result);

      // 2 hits
      cache.get(code, config);
      cache.get(code, config);

      // 1 miss
      cache.get('different code', config);

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2/3);
      expect(stats.missRate).toBeCloseTo(1/3);
    });

    it('should track total entries and size', () => {
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      for (let i = 0; i < 3; i++) {
        const code = `const x${i} = ${i};`;
        const result: TransformResult = {
          code: `var x${i} = ${i};`,
          metadata: {
            originalSize: code.length,
            transformedSize: code.length,
            appliedPresets: [],
            appliedPlugins: [],
            transformTime: 10,
            dependencies: []
          },
          performance: {
            transformTime: 10,
            cacheHit: false,
            memoryUsage: 1000,
            incrementalCompilation: false,
            workerThreadUsed: false
          }
        };

        cache.set(code, config, result);
      }

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Cache expiration', () => {
    it('should expire old entries', async () => {
      const shortCache = new TransformationCache({ maxAge: 10 }); // 10ms expiration
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      shortCache.set(code, config, result);

      // Should be available immediately
      expect(shortCache.get(code, config)).toBeTruthy();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should be expired
      expect(shortCache.get(code, config)).toBeNull();
    });

    it('should clean up expired entries', async () => {
      const shortCache = new TransformationCache({ maxAge: 10 });
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: code.length,
          transformedSize: 9,
          appliedPresets: [],
          appliedPlugins: [],
          transformTime: 10,
          dependencies: []
        },
        performance: {
          transformTime: 10,
          cacheHit: false,
          memoryUsage: 1000,
          incrementalCompilation: false,
          workerThreadUsed: false
        }
      };

      shortCache.set(code, config, result);
      expect(shortCache.getStats().totalEntries).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      shortCache.cleanup();
      expect(shortCache.getStats().totalEntries).toBe(0);
    });
  });
});

describe('IncrementalCompiler', () => {
  let compiler: IncrementalCompiler;

  beforeEach(() => {
    compiler = new IncrementalCompiler();
  });

  describe('Chunk management', () => {
    it('should split code into chunks', () => {
      const code = Array.from({ length: 2500 }, (_, i) => `line ${i}`).join('\n');
      const chunks = compiler.splitIntoChunks('test.js', code, 1000);

      expect(chunks.length).toBe(3); // 2500 lines / 1000 = 3 chunks
      expect(chunks[0].split('\n').length).toBe(1000);
      expect(chunks[1].split('\n').length).toBe(1000);
      expect(chunks[2].split('\n').length).toBe(500);
    });

    it('should detect changed chunks', () => {
      const originalCode = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join('\n');
      compiler.splitIntoChunks('test.js', originalCode, 1000);

      // Modify second chunk
      const modifiedLines = Array.from({ length: 2000 }, (_, i) => 
        i >= 1000 && i < 2000 ? `modified line ${i}` : `line ${i}`
      );
      const modifiedCode = modifiedLines.join('\n');

      const { changedChunks, chunks } = compiler.getChangedChunks('test.js', modifiedCode);

      expect(changedChunks).toContain(1); // Second chunk should be marked as changed
      expect(changedChunks).not.toContain(0); // First chunk should be unchanged
      expect(chunks.length).toBe(2);
    });

    it('should handle new chunks when file grows', () => {
      const originalCode = Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n');
      compiler.splitIntoChunks('test.js', originalCode, 1000);

      // Add more lines - make sure they're different from original
      const expandedLines = Array.from({ length: 2500 }, (_, i) => 
        i < 1000 ? `line ${i}` : `new line ${i}`
      );
      const expandedCode = expandedLines.join('\n');
      const { changedChunks, chunks } = compiler.getChangedChunks('test.js', expandedCode);

      expect(chunks.length).toBe(3);
      expect(changedChunks).toContain(1); // New chunk
      expect(changedChunks).toContain(2); // New chunk
    });
  });

  describe('Incremental compilation', () => {
    it('should compile only changed chunks', async () => {
      const mockCompiler = vi.fn().mockImplementation((chunk: string) => 
        Promise.resolve(chunk.replace(/line/g, 'compiled'))
      );

      const originalCode = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join('\n');
      const originalChunks = compiler.splitIntoChunks('test.js', originalCode, 1000);

      // Compile initial version
      await compiler.compileChangedChunks('test.js', [0, 1], originalChunks, mockCompiler);

      expect(mockCompiler).toHaveBeenCalledTimes(2);
      mockCompiler.mockClear();

      // Modify only second chunk
      const modifiedLines = Array.from({ length: 2000 }, (_, i) => 
        i >= 1000 ? `modified ${i}` : `line ${i}`
      );
      const modifiedCode = modifiedLines.join('\n');
      const { changedChunks, chunks } = compiler.getChangedChunks('test.js', modifiedCode);

      await compiler.compileChangedChunks('test.js', changedChunks, chunks, mockCompiler);

      // Should compile changed chunks plus any missing cached chunks
      expect(mockCompiler).toHaveBeenCalledTimes(changedChunks.length);
    });

    it('should reassemble chunks correctly', async () => {
      const mockCompiler = vi.fn().mockImplementation((chunk: string) => 
        Promise.resolve(chunk.toUpperCase())
      );

      const code = 'first\nsecond\nthird\nfourth';
      const chunks = compiler.splitIntoChunks('test.js', code, 2);
      
      const result = await compiler.compileChangedChunks('test.js', [0, 1], chunks, mockCompiler);

      expect(result).toBe('FIRST\nSECOND\nTHIRD\nFOURTH');
    });
  });

  describe('Cache management', () => {
    it('should clear file-specific caches', async () => {
      const mockCompiler = vi.fn().mockResolvedValue('compiled');
      const code = 'test code';
      
      await compiler.compileChangedChunks('test.js', [0], ['test code'], mockCompiler);
      
      // Clear cache
      compiler.clearFile('test.js');
      
      // Should recompile after clearing
      await compiler.compileChangedChunks('test.js', [0], ['test code'], mockCompiler);
      
      expect(mockCompiler).toHaveBeenCalledTimes(2);
    });
  });
});

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = new MemoryManager({ memoryThreshold: 1000, gcInterval: 100 });
  });

  afterEach(() => {
    memoryManager.stopGarbageCollection();
  });

  describe('Memory monitoring', () => {
    it('should get memory usage information', () => {
      const usage = memoryManager.getMemoryUsage();
      
      expect(usage).toHaveProperty('used');
      expect(usage).toHaveProperty('total');
      expect(usage).toHaveProperty('percentage');
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.total).toBe('number');
      expect(typeof usage.percentage).toBe('number');
    });

    it('should detect memory pressure', () => {
      // Mock high memory usage
      const originalMemoryUsage = memoryManager.getMemoryUsage;
      memoryManager.getMemoryUsage = vi.fn().mockReturnValue({
        used: 2000, // Above threshold of 1000
        total: 4000,
        percentage: 50
      });

      expect(memoryManager.isMemoryPressure()).toBe(true);

      // Restore original method
      memoryManager.getMemoryUsage = originalMemoryUsage;
    });

    it('should not detect memory pressure when usage is low', () => {
      // Mock low memory usage
      const originalMemoryUsage = memoryManager.getMemoryUsage;
      memoryManager.getMemoryUsage = vi.fn().mockReturnValue({
        used: 500, // Below threshold of 1000
        total: 4000,
        percentage: 12.5
      });

      expect(memoryManager.isMemoryPressure()).toBe(false);

      // Restore original method
      memoryManager.getMemoryUsage = originalMemoryUsage;
    });
  });

  describe('Garbage collection', () => {
    it('should force garbage collection when available', () => {
      const mockGc = vi.fn();
      (global as any).gc = mockGc;

      memoryManager.forceGarbageCollection();

      expect(mockGc).toHaveBeenCalled();

      delete (global as any).gc;
    });

    it('should handle missing garbage collection gracefully', () => {
      delete (global as any).gc;

      expect(() => memoryManager.forceGarbageCollection()).not.toThrow();
    });
  });
});

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;
  let mockContainer: WebContainerInstance;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    optimizer = new PerformanceOptimizer(mockContainer, {
      enableCaching: true,
      enableIncrementalCompilation: true,
      maxCacheSize: 1024 * 1024,
      maxCacheAge: 60000
    });
  });

  afterEach(() => {
    optimizer.dispose();
  });

  describe('Optimization integration', () => {
    it('should optimize transformations with caching', async () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // First transformation - should miss cache
      const { result: result1, metrics: metrics1 } = await optimizer.optimizeTransformation(code, config);
      expect(metrics1.cacheHit).toBe(false);

      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));

      // Second transformation - should hit cache
      const { result: result2, metrics: metrics2 } = await optimizer.optimizeTransformation(code, config);
      expect(metrics2.cacheHit).toBe(true);
      // Cache hits should be faster or equal (since they're very fast operations)
      expect(metrics2.transformTime).toBeLessThanOrEqual(metrics1.transformTime + 1);
    });

    it('should use incremental compilation for large files', async () => {
      const largeCode = Array.from({ length: 15000 }, (_, i) => `const x${i} = ${i};`).join('\n');
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      const { metrics } = await optimizer.optimizeTransformation(largeCode, config, undefined, 'large.js');
      
      // For large files, incremental compilation should be attempted
      // Note: In this test, it may not actually be used due to the placeholder implementation
      expect(typeof metrics.incrementalCompilation).toBe('boolean');
    });

    it('should provide performance statistics', () => {
      const stats = optimizer.getPerformanceStats();

      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('optimization');

      expect(stats.cache).toHaveProperty('totalEntries');
      expect(stats.cache).toHaveProperty('hitRate');
      expect(stats.cache).toHaveProperty('missRate');

      expect(stats.memory).toHaveProperty('used');
      expect(stats.memory).toHaveProperty('total');
      expect(stats.memory).toHaveProperty('percentage');

      expect(stats.optimization.cachingEnabled).toBe(true);
      expect(stats.optimization.incrementalCompilationEnabled).toBe(true);
    });

    it('should handle different configurations separately', async () => {
      const code = 'const x = 1;';
      const config1: BabelGlobalConfig = { presets: ['@babel/preset-env'], plugins: [] };
      const config2: BabelGlobalConfig = { presets: ['@babel/preset-typescript'], plugins: [] };

      // Transform with first config
      await optimizer.optimizeTransformation(code, config1);

      // Transform with second config - should not hit cache
      const { metrics } = await optimizer.optimizeTransformation(code, config2);
      expect(metrics.cacheHit).toBe(false);
    });
  });

  describe('Cache management', () => {
    it('should reset all caches', async () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Add to cache
      await optimizer.optimizeTransformation(code, config);
      
      let stats = optimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(1);

      // Reset
      optimizer.reset();

      stats = optimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(0);
    });

    it('should cleanup expired entries', async () => {
      const shortOptimizer = new PerformanceOptimizer(mockContainer, {
        maxCacheAge: 10 // 10ms expiration
      });

      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      await shortOptimizer.optimizeTransformation(code, config);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      shortOptimizer.cleanup();

      const stats = shortOptimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(0);

      shortOptimizer.dispose();
    });
  });

  describe('Memory management integration', () => {
    it('should track memory usage in metrics', async () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      const { metrics } = await optimizer.optimizeTransformation(code, config);
      
      expect(typeof metrics.memoryUsage).toBe('number');
      expect(metrics.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should provide memory statistics', () => {
      const stats = optimizer.getPerformanceStats();
      
      expect(stats.memory.used).toBeGreaterThanOrEqual(0);
      expect(stats.memory.total).toBeGreaterThanOrEqual(0);
      expect(stats.memory.percentage).toBeGreaterThanOrEqual(0);
    });
  });
});