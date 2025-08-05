/**
 * BatchProcessor - Manages batch execution of files
 */

import type { 
  ExecutionQueueEntry, 
  BatchExecutionConfig, 
  FileChangeEvent,
  FileDependency 
} from './types.js';
import type { MetricsCollector } from './MetricsCollector.js';

export class BatchProcessor {
  private batchConfig: BatchExecutionConfig;
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private activeBatches: Map<string, ExecutionQueueEntry[]> = new Map();
  private metricsCollector: MetricsCollector;

  constructor(batchConfig: BatchExecutionConfig, metricsCollector: MetricsCollector) {
    this.batchConfig = batchConfig;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Schedule batch execution
   */
  public scheduleBatch(
    event: FileChangeEvent,
    createExecutionEntry: (filePath: string, content: string, language: string) => ExecutionQueueEntry,
    detectLanguage: (filePath: string) => string,
    onBatchReady: (entries: ExecutionQueueEntry[]) => void
  ): void {
    if (event.changeType === 'deleted') {
      return; // Don't batch deleted files
    }

    const batchId = this.getBatchId(event.filePath);
    const entry = createExecutionEntry(
      event.filePath,
      event.content || '',
      detectLanguage(event.filePath)
    );
    entry.batchId = batchId;

    // Add to current batch
    if (!this.activeBatches.has(batchId)) {
      this.activeBatches.set(batchId, []);
    }
    
    const batch = this.activeBatches.get(batchId)!;
    
    // Remove existing entry for same file
    const existingIndex = batch.findIndex(e => e.filePath === entry.filePath);
    if (existingIndex >= 0) {
      batch.splice(existingIndex, 1);
    }
    
    batch.push(entry);

    // Clear existing batch timer
    const existingTimer = this.batchTimers.get(batchId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new batch timer
    const batchWindow = this.batchConfig.batchWindow;
    const timer = setTimeout(() => {
      this.processBatch(batchId, onBatchReady);
      this.batchTimers.delete(batchId);
    }, batchWindow);

    this.batchTimers.set(batchId, timer);
    console.log(`📦 Added ${event.filePath} to batch ${batchId} (${batch.length} files, window: ${batchWindow}ms)`);
  }

  /**
   * Process a batch of files
   */
  public processBatch(
    batchId: string,
    onBatchReady: (entries: ExecutionQueueEntry[]) => void
  ): void {
    const batch = this.activeBatches.get(batchId);
    if (!batch || batch.length === 0) {
      return;
    }

    console.log(`📦 Processing batch ${batchId} with ${batch.length} files`);

    // Sort batch by dependencies if enabled
    let sortedBatch = batch;
    if (this.batchConfig.dependencyResolution) {
      sortedBatch = this.sortByDependencies(batch);
    }

    // Clean up batch
    this.activeBatches.delete(batchId);

    // Notify that batch is ready
    onBatchReady(sortedBatch);
  }

  /**
   * Get batch ID for a file using intelligent grouping
   */
  public getBatchId(filePath: string): string {
    // Use more intelligent batching strategies
    
    // Strategy 1: Group by project structure
    const pathParts = filePath.split('/');
    
    // Group files in the same immediate directory
    if (pathParts.length > 1) {
      const dir = pathParts.slice(0, -1).join('/');
      
      // Special handling for common project structures
      if (dir.includes('/src/') || dir.includes('/lib/') || dir.includes('/components/')) {
        // Group by feature/module within these directories
        const relevantParts = pathParts.slice(-3, -1); // Take last 2 directory levels
        return `batch_${relevantParts.join('_').replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      
      return `batch_${dir.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    
    // Fallback: group root files together
    return 'batch_root';
  }

  /**
   * Sort entries by dependencies
   */
  public sortByDependencies(entries: ExecutionQueueEntry[]): ExecutionQueueEntry[] {
    const sorted: ExecutionQueueEntry[] = [];
    const remaining = [...entries];
    const processed = new Set<string>();

    // Simple topological sort
    while (remaining.length > 0) {
      let found = false;
      
      for (let i = 0; i < remaining.length; i++) {
        const entry = remaining[i];
        const dependency: FileDependency | undefined = this.metricsCollector.getFileDependency(entry.filePath);
        
        // Check if all dependencies are already processed
        let canProcess = true;
        if (dependency) {
          for (const dep of dependency.dependencies) {
            if (entries.some(e => e.filePath === dep) && !processed.has(dep)) {
              canProcess = false;
              break;
            }
          }
        }
        
        if (canProcess) {
          sorted.push(entry);
          processed.add(entry.filePath);
          remaining.splice(i, 1);
          found = true;
          break;
        }
      }
      
      // If no progress, add remaining files (circular dependencies or missing deps)
      if (!found && remaining.length > 0) {
        sorted.push(...remaining);
        break;
      }
    }

    return sorted;
  }

  /**
   * Force process all pending batches
   */
  public async flushBatches(onBatchReady: (entries: ExecutionQueueEntry[]) => void): Promise<void> {
    const batchIds = Array.from(this.activeBatches.keys());
    
    // Clear all batch timers
    this.clearBatchTimers();
    
    // Process all batches
    for (const batchId of batchIds) {
      this.processBatch(batchId, onBatchReady);
    }
    
    console.log(`📦 Flushed ${batchIds.length} batches`);
  }

  /**
   * Clear batch timers
   */
  public clearBatchTimers(): void {
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
  }

  /**
   * Clear active batches
   */
  public clearActiveBatches(): void {
    this.activeBatches.clear();
    this.clearBatchTimers();
    console.log('🗑️ Active batches cleared');
  }

  /**
   * Get active batches
   */
  public getActiveBatches(): Map<string, ExecutionQueueEntry[]> {
    return new Map(this.activeBatches);
  }

  /**
   * Update batch configuration
   */
  public setBatchConfig(config: Partial<BatchExecutionConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
    console.log('📦 Batch configuration updated:', this.batchConfig);
  }

  /**
   * Get batch configuration
   */
  public getBatchConfig(): BatchExecutionConfig {
    return { ...this.batchConfig };
  }

  /**
   * Remove file from all batches
   */
  public removeFileFromBatches(filePath: string): boolean {
    let removed = false;
    
    for (const [batchId, batch] of this.activeBatches) {
      const initialLength = batch.length;
      const filtered = batch.filter(entry => entry.filePath !== filePath);
      
      if (filtered.length !== initialLength) {
        removed = true;
        
        if (filtered.length === 0) {
          this.activeBatches.delete(batchId);
          const timer = this.batchTimers.get(batchId);
          if (timer) {
            clearTimeout(timer);
            this.batchTimers.delete(batchId);
          }
        } else {
          this.activeBatches.set(batchId, filtered);
        }
      }
    }
    
    return removed;
  }

  /**
   * Check if files should be batched together
   */
  private shouldBatchTogether(file1: string, file2: string): boolean {
    // Check if files are in the same directory
    const dir1 = file1.substring(0, file1.lastIndexOf('/'));
    const dir2 = file2.substring(0, file2.lastIndexOf('/'));
    
    if (dir1 === dir2) return true;
    
    // Check if files have dependency relationships
    const dep1: FileDependency | undefined = this.metricsCollector.getFileDependency(file1);
    const dep2: FileDependency | undefined = this.metricsCollector.getFileDependency(file2);
    
    if (dep1?.dependencies.includes(file2) || dep1?.dependents.includes(file2)) {
      return true;
    }
    
    if (dep2?.dependencies.includes(file1) || dep2?.dependents.includes(file1)) {
      return true;
    }
    
    // Check if files are of the same type and in related directories
    const ext1 = file1.split('.').pop();
    const ext2 = file2.split('.').pop();
    
    if (ext1 === ext2) {
      // Same file type, check if directories are related
      const commonPath = this.findCommonPath(dir1, dir2);
      return commonPath.length > 0;
    }
    
    return false;
  }

  /**
   * Find common path between two directories
   */
  private findCommonPath(path1: string, path2: string): string {
    const parts1 = path1.split('/');
    const parts2 = path2.split('/');
    const common: string[] = [];
    
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        common.push(parts1[i]);
      } else {
        break;
      }
    }
    
    return common.join('/');
  }
}