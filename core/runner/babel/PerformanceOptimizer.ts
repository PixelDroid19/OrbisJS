/**
 * Performance Optimizer for WebContainer Babel Integration
 * Implements intelligent caching, incremental compilation, and memory management
 */

import type { WebContainerInstance } from '../types.js';
import type { TransformResult, TransformOptions, BabelGlobalConfig } from './types.js';

export interface CacheEntry {
  key: string;
  originalCode: string;
  transformedCode: string;
  sourceMap?: string;
  config: BabelGlobalConfig;
  metadata: TransformMetadata;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

export interface TransformMetadata {
  originalSize: number;
  transformedSize: number;
  appliedPresets: string[];
  appliedPlugins: string[];
  transformTime: number;
  dependencies: string[];
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageTransformTime: number;
  cacheEfficiency: number;
  memoryUsage: number;
}

export interface PerformanceMetrics {
  transformTime: number;
  cacheHit: boolean;
  memoryUsage: number;
  cpuUsage?: number;
  incrementalCompilation: boolean;
  workerThreadUsed: boolean;
}

export interface OptimizationOptions {
  enableCaching: boolean;
  enableIncrementalCompilation: boolean;
  enableWorkerThreads: boolean;
  maxCacheSize: number;
  maxCacheAge: number;
  memoryThreshold: number;
  compressionEnabled: boolean;
}

/**
 * Intelligent caching system for Babel transformations
 */
export class TransformationCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxAge: number;
  private hits = 0;
  private misses = 0;
  private compressionEnabled: boolean;

  constructor(options: { maxSize?: number; maxAge?: number; compressionEnabled?: boolean } = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.compressionEnabled = options.compressionEnabled || false;
  }

  /**
   * Generate cache key from code and configuration
   */
  private generateCacheKey(code: string, config: BabelGlobalConfig, options?: TransformOptions): string {
    const configHash = this.hashObject(config);
    const optionsHash = options ? this.hashObject(options) : '';
    const codeHash = this.hashString(code);
    return `${codeHash}-${configHash}-${optionsHash}`;
  }

  /**
   * Simple hash function for objects
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this.hashString(str);
  }

  /**
   * Simple hash function for strings
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Get cached transformation result
   */
  get(code: string, config: BabelGlobalConfig, options?: TransformOptions): CacheEntry | null {
    const key = this.generateCacheKey(code, config, options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry is expired
    const now = new Date();
    if (now.getTime() - entry.createdAt.getTime() > this.maxAge) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = now;
    entry.accessCount++;
    this.hits++;

    return entry;
  }

  /**
   * Store transformation result in cache
   */
  set(
    code: string,
    config: BabelGlobalConfig,
    result: TransformResult,
    options?: TransformOptions
  ): void {
    const key = this.generateCacheKey(code, config, options);
    const now = new Date();

    const entry: CacheEntry = {
      key,
      originalCode: code,
      transformedCode: result.code,
      sourceMap: result.map ? JSON.stringify(result.map) : undefined,
      config,
      metadata: result.metadata,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0, // Will be incremented on first access
      size: this.calculateEntrySize(code, result.code, result.map)
    };

    // Check if we need to make space
    this.ensureCapacity(entry.size);

    this.cache.set(key, entry);
  }

  /**
   * Calculate the size of a cache entry
   */
  private calculateEntrySize(originalCode: string, transformedCode: string, sourceMap?: any): number {
    let size = originalCode.length + transformedCode.length;
    if (sourceMap) {
      size += JSON.stringify(sourceMap).length;
    }
    return size;
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    let currentSize = this.getCurrentSize();
    
    if (currentSize + newEntrySize <= this.maxSize) {
      return;
    }

    // Remove least recently used entries until we have space
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    for (const [key, entry] of entries) {
      this.cache.delete(key);
      currentSize -= entry.size;
      
      if (currentSize + newEntrySize <= this.maxSize) {
        break;
      }
    }
  }

  /**
   * Get current cache size
   */
  private getCurrentSize(): number {
    return Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.misses / totalRequests : 0;
    
    const entries = Array.from(this.cache.values());
    const averageTransformTime = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.metadata.transformTime, 0) / entries.length
      : 0;

    return {
      totalEntries: this.cache.size,
      totalSize: this.getCurrentSize(),
      hitRate,
      missRate,
      averageTransformTime,
      cacheEfficiency: hitRate,
      memoryUsage: this.getCurrentSize()
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now.getTime() - entry.createdAt.getTime() > this.maxAge) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));
  }
}

/**
 * Incremental compilation system for large files
 */
export class IncrementalCompiler {
  private fileChunks = new Map<string, string[]>();
  private chunkHashes = new Map<string, string>();
  private compiledChunks = new Map<string, string>();

  /**
   * Split file into chunks for incremental compilation
   */
  splitIntoChunks(filePath: string, code: string, chunkSize = 1000): string[] {
    const lines = code.split('\n');
    const chunks: string[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      chunks.push(chunk);
    }

    // Only update stored chunks if this is the first time or we're explicitly updating
    if (!this.fileChunks.has(filePath)) {
      this.fileChunks.set(filePath, chunks);
    }
    
    return chunks;
  }

  /**
   * Detect which chunks have changed
   */
  getChangedChunks(filePath: string, newCode: string): { changedChunks: number[]; chunks: string[] } {
    const oldChunks = this.fileChunks.get(filePath) || [];
    const newChunks = this.splitIntoChunks(filePath, newCode);
    const changedChunks: number[] = [];

    for (let i = 0; i < Math.max(newChunks.length, oldChunks.length); i++) {
      const newChunk = newChunks[i] || '';
      const oldChunk = oldChunks[i] || '';
      
      if (newChunk !== oldChunk) {
        changedChunks.push(i);
      }
    }

    // Update stored chunks after comparison
    this.fileChunks.set(filePath, newChunks);

    return { changedChunks, chunks: newChunks };
  }

  /**
   * Compile only changed chunks
   */
  async compileChangedChunks(
    filePath: string,
    changedChunks: number[],
    chunks: string[],
    compiler: (chunk: string) => Promise<string>
  ): Promise<string> {
    // Compile changed chunks
    for (const chunkIndex of changedChunks) {
      const chunk = chunks[chunkIndex];
      const compiled = await compiler(chunk);
      this.compiledChunks.set(`${filePath}:${chunkIndex}`, compiled);
    }

    // Reassemble all chunks
    const result: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const compiledChunk = this.compiledChunks.get(`${filePath}:${i}`);
      if (compiledChunk) {
        result.push(compiledChunk);
      } else {
        // Compile chunk if not cached
        const compiled = await compiler(chunks[i]);
        this.compiledChunks.set(`${filePath}:${i}`, compiled);
        result.push(compiled);
      }
    }

    return result.join('\n');
  }

  /**
   * Clear compilation cache for file
   */
  clearFile(filePath: string): void {
    this.fileChunks.delete(filePath);
    
    // Remove all chunks for this file
    const keysToDelete = Array.from(this.compiledChunks.keys())
      .filter(key => key.startsWith(`${filePath}:`));
    
    keysToDelete.forEach(key => this.compiledChunks.delete(key));
  }
}

/**
 * Memory management system
 */
export class MemoryManager {
  private memoryThreshold: number;
  private gcInterval: number;
  private gcTimer?: NodeJS.Timeout;

  constructor(options: { memoryThreshold?: number; gcInterval?: number } = {}) {
    this.memoryThreshold = options.memoryThreshold || 500 * 1024 * 1024; // 500MB
    this.gcInterval = options.gcInterval || 60000; // 1 minute
    this.startGarbageCollection();
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: (usage.heapUsed / usage.heapTotal) * 100
      };
    }
    
    // Fallback for browser environments
    return { used: 0, total: 0, percentage: 0 };
  }

  /**
   * Check if memory usage is above threshold
   */
  isMemoryPressure(): boolean {
    const usage = this.getMemoryUsage();
    return usage.used > this.memoryThreshold;
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  /**
   * Start automatic garbage collection
   */
  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      if (this.isMemoryPressure()) {
        this.forceGarbageCollection();
      }
    }, this.gcInterval);
  }

  /**
   * Stop automatic garbage collection
   */
  stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
  }
}

/**
 * Main performance optimizer
 */
export class PerformanceOptimizer {
  private cache: TransformationCache;
  private incrementalCompiler: IncrementalCompiler;
  private memoryManager: MemoryManager;
  private options: OptimizationOptions;
  private container: WebContainerInstance;

  constructor(container: WebContainerInstance, options: Partial<OptimizationOptions> = {}) {
    this.container = container;
    this.options = {
      enableCaching: true,
      enableIncrementalCompilation: true,
      enableWorkerThreads: false, // Disabled by default in WebContainer
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
      memoryThreshold: 500 * 1024 * 1024, // 500MB
      compressionEnabled: false,
      ...options
    };

    this.cache = new TransformationCache({
      maxSize: this.options.maxCacheSize,
      maxAge: this.options.maxCacheAge,
      compressionEnabled: this.options.compressionEnabled
    });

    this.incrementalCompiler = new IncrementalCompiler();
    this.memoryManager = new MemoryManager({
      memoryThreshold: this.options.memoryThreshold
    });
  }

  /**
   * Optimize transformation with caching and incremental compilation
   */
  async optimizeTransformation(
    code: string,
    config: BabelGlobalConfig,
    options?: TransformOptions,
    filePath?: string
  ): Promise<{ result: TransformResult; metrics: PerformanceMetrics }> {
    const startTime = Date.now();
    let cacheHit = false;
    let incrementalCompilation = false;
    let workerThreadUsed = false;

    // Try cache first
    if (this.options.enableCaching) {
      const cached = this.cache.get(code, config, options);
      if (cached) {
        cacheHit = true;
        const cacheHitTime = Date.now() - startTime;
        const result: TransformResult = {
          code: cached.transformedCode,
          map: cached.sourceMap ? JSON.parse(cached.sourceMap) : undefined,
          metadata: {
            ...cached.metadata,
            transformTime: cacheHitTime // Update with actual cache hit time
          },
          performance: {
            transformTime: cacheHitTime,
            cacheHit: true,
            memoryUsage: this.memoryManager.getMemoryUsage().used,
            incrementalCompilation: false,
            workerThreadUsed: false
          }
        };

        return {
          result,
          metrics: result.performance
        };
      }
    }

    // Check for incremental compilation
    let transformedCode: string;
    if (this.options.enableIncrementalCompilation && filePath && code.length > 10000) {
      incrementalCompilation = true;
      const { changedChunks, chunks } = this.incrementalCompiler.getChangedChunks(filePath, code);
      
      if (changedChunks.length < chunks.length * 0.5) { // Less than 50% changed
        transformedCode = await this.incrementalCompiler.compileChangedChunks(
          filePath,
          changedChunks,
          chunks,
          async (chunk) => {
            // This would be the actual Babel transformation
            return chunk; // Placeholder
          }
        );
      } else {
        // Full compilation is more efficient
        transformedCode = code; // Placeholder
        incrementalCompilation = false;
      }
    } else {
      // Full compilation
      transformedCode = code; // Placeholder
    }

    const transformTime = Date.now() - startTime;
    const memoryUsage = this.memoryManager.getMemoryUsage().used;

    const metadata: TransformMetadata = {
      originalSize: code.length,
      transformedSize: transformedCode.length,
      appliedPresets: [], // Would be populated by actual Babel transformation
      appliedPlugins: [], // Would be populated by actual Babel transformation
      transformTime,
      dependencies: []
    };

    const result: TransformResult = {
      code: transformedCode,
      metadata,
      performance: {
        transformTime,
        cacheHit,
        memoryUsage,
        incrementalCompilation,
        workerThreadUsed
      }
    };

    // Cache the result
    if (this.options.enableCaching) {
      this.cache.set(code, config, result, options);
    }

    return {
      result,
      metrics: result.performance
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    cache: CacheStats;
    memory: ReturnType<MemoryManager['getMemoryUsage']>;
    optimization: {
      cachingEnabled: boolean;
      incrementalCompilationEnabled: boolean;
      workerThreadsEnabled: boolean;
    };
  } {
    return {
      cache: this.cache.getStats(),
      memory: this.memoryManager.getMemoryUsage(),
      optimization: {
        cachingEnabled: this.options.enableCaching,
        incrementalCompilationEnabled: this.options.enableIncrementalCompilation,
        workerThreadsEnabled: this.options.enableWorkerThreads
      }
    };
  }

  /**
   * Clear all caches and reset
   */
  reset(): void {
    this.cache.clear();
    // Clear incremental compiler caches would go here
  }

  /**
   * Cleanup expired entries and optimize memory
   */
  cleanup(): void {
    this.cache.cleanup();
    
    if (this.memoryManager.isMemoryPressure()) {
      this.memoryManager.forceGarbageCollection();
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.memoryManager.stopGarbageCollection();
    this.reset();
  }
}