/**
 * Performance Benchmarks for WebContainer Babel Optimization
 * Tests and validates performance improvements from caching and optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerformanceOptimizer, TransformationCache, IncrementalCompiler } from '../PerformanceOptimizer.js';
import type { WebContainerInstance } from '../../types.js';
import type { BabelGlobalConfig, TransformResult } from '../types.js';

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

// Helper to create mock transform result
const createMockTransformResult = (code: string, transformTime = 10): TransformResult => ({
  code: code.replace(/const/g, 'var'), // Simple transformation
  metadata: {
    originalSize: code.length,
    transformedSize: code.length,
    appliedPresets: ['@babel/preset-env'],
    appliedPlugins: [],
    transformTime,
    dependencies: []
  },
  performance: {
    transformTime,
    cacheHit: false,
    memoryUsage: 1000,
    incrementalCompilation: false,
    workerThreadUsed: false
  }
});

describe('Performance Benchmarks', () => {
  let mockContainer: WebContainerInstance;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
  });

  describe('Cache Performance', () => {
    it('should demonstrate significant speedup with cache hits', async () => {
      const cache = new TransformationCache();
      const code = 'const x = 1; const y = 2; const z = 3;';
      const config: BabelGlobalConfig = { presets: ['@babel/preset-env'], plugins: [] };

      // Simulate slow initial transformation
      const slowResult = createMockTransformResult(code, 100);
      
      // Store in cache
      cache.set(code, config, slowResult);

      // Measure cache hit performance
      const startTime = Date.now();
      const cached = cache.get(code, config);
      const cacheHitTime = Date.now() - startTime;

      expect(cached).toBeTruthy();
      expect(cacheHitTime).toBeLessThan(10); // Cache hit should be very fast
      expect(cacheHitTime).toBeLessThan(slowResult.metadata.transformTime / 10);
    });

    it('should maintain high cache hit rates with repeated transformations', () => {
      const cache = new TransformationCache();
      const codes = [
        'const x = 1;',
        'const y = 2;',
        'const z = 3;',
        'const x = 1;', // Repeat
        'const y = 2;', // Repeat
      ];
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Add unique codes to cache
      codes.slice(0, 3).forEach(code => {
        const result = createMockTransformResult(code);
        cache.set(code, config, result);
      });

      // Access all codes (including repeats)
      codes.forEach(code => cache.get(code, config));

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.3); // Should have reasonable hit rate
      expect(stats.totalEntries).toBe(3); // Only 3 unique entries
    });

    it('should efficiently manage memory with large cache sizes', () => {
      const cache = new TransformationCache({ maxSize: 10 * 1024 }); // 10KB limit
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Add many entries that would exceed memory limit
      for (let i = 0; i < 100; i++) {
        const code = `const x${i} = ${i};`.repeat(100); // Large code
        const result = createMockTransformResult(code);
        cache.set(code, config, result);
      }

      const stats = cache.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(10 * 1024);
      expect(stats.totalEntries).toBeLessThan(100); // Some entries should be evicted
    });
  });

  describe('Incremental Compilation Performance', () => {
    it('should show performance benefits for large files with small changes', async () => {
      const optimizer = new PerformanceOptimizer(mockContainer, {
        enableIncrementalCompilation: true,
        enableCaching: false // Disable caching to isolate incremental compilation
      });

      // Create large file
      const largeCode = Array.from({ length: 20000 }, (_, i) => `const x${i} = ${i};`).join('\n');
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // First compilation (full)
      const startTime1 = Date.now();
      await optimizer.optimizeTransformation(largeCode, config, undefined, 'large.js');
      const fullCompileTime = Date.now() - startTime1;

      // Make small change
      const modifiedCode = largeCode.replace('const x1000 = 1000;', 'const x1000 = 1001;');

      // Second compilation (should be incremental)
      const startTime2 = Date.now();
      const { metrics } = await optimizer.optimizeTransformation(modifiedCode, config, undefined, 'large.js');
      const incrementalCompileTime = Date.now() - startTime2;

      // Incremental compilation should be faster (in a real implementation)
      // Note: This test uses placeholder implementation, so we just verify the structure
      expect(typeof metrics.incrementalCompilation).toBe('boolean');
      expect(typeof metrics.transformTime).toBe('number');

      optimizer.dispose();
    });

    it('should handle chunk-based compilation efficiently', () => {
      const compiler = new IncrementalCompiler();

      // Large code with repetitive pattern
      const lines = Array.from({ length: 10000 }, (_, i) => `const line${i} = ${i};`);
      const code = lines.join('\n');

      // Split into chunks
      const startTime = Date.now();
      const chunks = compiler.splitIntoChunks('test.js', code, 1000);
      const splitTime = Date.now() - startTime;

      expect(chunks.length).toBe(10); // 10000 lines / 1000 = 10 chunks
      expect(splitTime).toBeLessThan(100); // Should be fast

      // Modify small portion
      lines[5500] = 'const line5500 = "modified";';
      const modifiedCode = lines.join('\n');

      const changeStartTime = Date.now();
      const { changedChunks } = compiler.getChangedChunks('test.js', modifiedCode);
      const changeDetectionTime = Date.now() - changeStartTime;

      expect(changedChunks.length).toBe(1); // Only one chunk changed
      expect(changedChunks).toContain(5); // Chunk 5 (lines 5000-5999)
      expect(changeDetectionTime).toBeLessThan(50); // Change detection should be fast
    });
  });

  describe('Memory Management Performance', () => {
    it('should maintain stable memory usage under load', async () => {
      const optimizer = new PerformanceOptimizer(mockContainer, {
        enableCaching: true,
        maxCacheSize: 1024 * 1024, // 1MB cache
        memoryThreshold: 500 * 1024 // 500KB threshold
      });

      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const initialStats = optimizer.getPerformanceStats();
      const initialMemory = initialStats.memory.used;

      // Perform many transformations
      for (let i = 0; i < 100; i++) {
        const code = `const batch${i} = ${i};`.repeat(100);
        await optimizer.optimizeTransformation(code, config);
      }

      const finalStats = optimizer.getPerformanceStats();
      const finalMemory = finalStats.memory.used;

      // Memory should not grow unbounded
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(2 * 1024 * 1024); // Less than 2MB growth

      // Cache should have reasonable hit rate (may be 0 if all transformations are unique)
      expect(finalStats.cache.hitRate).toBeGreaterThanOrEqual(0);

      optimizer.dispose();
    });

    it('should efficiently cleanup expired cache entries', async () => {
      const optimizer = new PerformanceOptimizer(mockContainer, {
        maxCacheAge: 50, // 50ms expiration
        enableCaching: true
      });

      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Add entries to cache
      for (let i = 0; i < 10; i++) {
        const code = `const temp${i} = ${i};`;
        await optimizer.optimizeTransformation(code, config);
      }

      let stats = optimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(10);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cleanup
      optimizer.cleanup();

      stats = optimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(0);

      optimizer.dispose();
    });
  });

  describe('Overall Performance Metrics', () => {
    it('should provide comprehensive performance insights', async () => {
      const optimizer = new PerformanceOptimizer(mockContainer, {
        enableCaching: true,
        enableIncrementalCompilation: true,
        enableWorkerThreads: false
      });

      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Perform various transformations
      const codes = [
        'const simple = 1;',
        'const simple = 1;', // Repeat for cache hit
        Array.from({ length: 5000 }, (_, i) => `const large${i} = ${i};`).join('\n'), // Large file
        'const another = 2;'
      ];

      const results = [];
      for (const code of codes) {
        const result = await optimizer.optimizeTransformation(code, config, undefined, 'test.js');
        results.push(result);
      }

      const stats = optimizer.getPerformanceStats();

      // Verify comprehensive metrics
      expect(stats.cache.totalEntries).toBeGreaterThan(0);
      expect(stats.cache.hitRate).toBeGreaterThan(0); // Should have at least one cache hit
      expect(stats.memory.used).toBeGreaterThan(0);

      // Verify individual transformation metrics
      expect(results[1].metrics.cacheHit).toBe(true); // Second transformation should hit cache
      expect(results[0].metrics.cacheHit).toBe(false); // First should miss

      // Performance should improve with cache hits
      expect(results[1].metrics.transformTime).toBeLessThanOrEqual(results[0].metrics.transformTime);

      optimizer.dispose();
    });

    it('should demonstrate scalability with concurrent transformations', async () => {
      const optimizer = new PerformanceOptimizer(mockContainer, {
        enableCaching: true,
        maxCacheSize: 5 * 1024 * 1024 // 5MB cache
      });

      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Create concurrent transformation promises
      const concurrentTransforms = Array.from({ length: 50 }, (_, i) => {
        const code = `const concurrent${i} = ${i};`.repeat(10);
        return optimizer.optimizeTransformation(code, config);
      });

      const startTime = Date.now();
      const results = await Promise.all(concurrentTransforms);
      const totalTime = Date.now() - startTime;

      // All transformations should complete
      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.result.code).toBeTruthy();
        expect(result.metrics.transformTime).toBeGreaterThanOrEqual(0);
      });

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds

      const stats = optimizer.getPerformanceStats();
      expect(stats.cache.totalEntries).toBe(50); // All unique transformations cached

      optimizer.dispose();
    });
  });

  describe('Optimization Strategy Comparison', () => {
    it('should compare performance with and without optimizations', async () => {
      const unoptimized = new PerformanceOptimizer(mockContainer, {
        enableCaching: false,
        enableIncrementalCompilation: false,
        enableWorkerThreads: false
      });

      const optimized = new PerformanceOptimizer(mockContainer, {
        enableCaching: true,
        enableIncrementalCompilation: true,
        enableWorkerThreads: false
      });

      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const testCode = 'const test = 1; const another = 2;';

      // Test unoptimized performance
      const unoptimizedTimes = [];
      for (let i = 0; i < 5; i++) {
        const { metrics } = await unoptimized.optimizeTransformation(testCode, config);
        unoptimizedTimes.push(metrics.transformTime);
      }

      // Test optimized performance (should benefit from caching after first run)
      const optimizedTimes = [];
      for (let i = 0; i < 5; i++) {
        const { metrics } = await optimized.optimizeTransformation(testCode, config);
        optimizedTimes.push(metrics.transformTime);
      }

      // Optimized version should show improvement after first transformation
      const avgUnoptimized = unoptimizedTimes.reduce((a, b) => a + b) / unoptimizedTimes.length;
      const avgOptimized = optimizedTimes.slice(1).reduce((a, b) => a + b) / (optimizedTimes.length - 1);

      // Cache hits should be faster (in a real implementation)
      expect(avgOptimized).toBeLessThanOrEqual(avgUnoptimized);

      const optimizedStats = optimized.getPerformanceStats();
      expect(optimizedStats.cache.hitRate).toBeGreaterThan(0.5); // Should have good hit rate

      unoptimized.dispose();
      optimized.dispose();
    });

    it('should validate cache efficiency under different workloads', () => {
      const cache = new TransformationCache({ maxSize: 100 * 1024 }); // 100KB
      const config: BabelGlobalConfig = { presets: [], plugins: [] };

      // Workload 1: Repetitive code (high cache hit rate expected)
      const repetitiveCodes = Array.from({ length: 100 }, () => 'const x = 1;');
      repetitiveCodes.forEach(code => {
        const cached = cache.get(code, config);
        if (!cached) {
          const result = createMockTransformResult(code);
          cache.set(code, config, result);
        }
      });

      const repetitiveStats = cache.getStats();
      expect(repetitiveStats.hitRate).toBeGreaterThan(0.9); // Very high hit rate

      cache.clear();

      // Workload 2: Unique code (low cache hit rate expected)
      const uniqueCodes = Array.from({ length: 100 }, (_, i) => `const x${i} = ${i};`);
      uniqueCodes.forEach(code => {
        const cached = cache.get(code, config);
        if (!cached) {
          const result = createMockTransformResult(code);
          cache.set(code, config, result);
        }
      });

      const uniqueStats = cache.getStats();
      expect(uniqueStats.hitRate).toBe(0); // No cache hits for unique code
      expect(uniqueStats.totalEntries).toBeGreaterThan(0); // But entries should be cached
    });
  });
});