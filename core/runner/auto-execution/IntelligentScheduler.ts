/**
 * IntelligentScheduler - Manages intelligent scheduling with debounce and priority
 */

import type { FileChangeEvent, PriorityFactors } from './types.js';
import type { MetricsCollector } from './MetricsCollector.js';

export class IntelligentScheduler {
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Schedule debounced execution with intelligent delay calculation
   */
  public scheduleDebounced(
    event: FileChangeEvent,
    baseDelay: number,
    callback: () => void
  ): void {
    // Calculate intelligent delay based on file characteristics
    const intelligentDelay = this.calculateIntelligentDelay(event.filePath, baseDelay);
    
    // Clear existing timer for this file
    this.clearDebounceTimer(event.filePath);

    // Set new timer with intelligent delay
    const timer = setTimeout(() => {
      callback();
      this.debounceTimers.delete(event.filePath);
    }, intelligentDelay);

    this.debounceTimers.set(event.filePath, timer);
    console.log(`⏱️ Debounced execution scheduled for ${event.filePath} in ${intelligentDelay}ms (base: ${baseDelay}ms)`);
  }

  /**
   * Clear debounce timer for specific file
   */
  public clearDebounceTimer(filePath: string): void {
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }
  }

  /**
   * Clear all debounce timers
   */
  public clearAllTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    console.log('🗑️ All debounce timers cleared');
  }

  /**
   * Calculate intelligent delay based on file characteristics
   */
  public calculateIntelligentDelay(filePath: string, baseDelay: number): number {
    const changeFreq = this.metricsCollector.getChangeFrequency(filePath);
    const factors = this.calculatePriorityFactors(filePath);
    
    // Reduce delay for high-priority files
    let multiplier = 1.0;
    
    // High importance files get shorter delays
    if (factors.fileImportance >= 8) {
      multiplier *= 0.5;
    } else if (factors.fileImportance >= 6) {
      multiplier *= 0.7;
    }
    
    // Files with high change frequency get longer delays to prevent thrashing
    if (changeFreq > 10) {
      multiplier *= 2.0;
    } else if (changeFreq > 5) {
      multiplier *= 1.5;
    }
    
    // Files with many dependents get shorter delays (they affect more files)
    if (factors.dependencyWeight >= 5) {
      multiplier *= 0.6;
    }
    
    // Recently executed files get longer delays
    if (factors.lastExecutionTime <= 2) {
      multiplier *= 1.5;
    }
    
    const intelligentDelay = Math.max(100, Math.min(5000, baseDelay * multiplier));
    return Math.round(intelligentDelay);
  }

  /**
   * Calculate priority factors for a file
   */
  public calculatePriorityFactors(filePath: string): PriorityFactors {
    const dependency = this.metricsCollector.getFileDependency(filePath);
    const changeFreq = this.metricsCollector.getChangeFrequency(filePath);
    const lastExecMinutes = this.metricsCollector.getMinutesSinceLastExecution(filePath);
    
    // Calculate file importance based on extension and path
    let fileImportance = 5; // Default importance
    
    const ext = filePath.split('.').pop()?.toLowerCase();
    const pathLower = filePath.toLowerCase();
    
    // Higher importance for main files
    if (pathLower.includes('main') || pathLower.includes('index') || pathLower.includes('app')) {
      fileImportance += 3;
    }
    
    // Higher importance for configuration files
    if (ext === 'json' && (pathLower.includes('package') || pathLower.includes('config'))) {
      fileImportance += 2;
    }
    
    // Higher importance for TypeScript/JavaScript files
    if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
      fileImportance += 1;
    }
    
    // Lower importance for test files
    if (pathLower.includes('test') || pathLower.includes('spec')) {
      fileImportance -= 2;
    }
    
    // Calculate dependency weight
    const dependencyWeight = dependency ? 
      (dependency.dependencies.length + dependency.dependents.length) : 0;
    
    return {
      fileImportance: Math.max(1, Math.min(10, fileImportance)),
      changeFrequency: changeFreq,
      dependencyWeight,
      lastExecutionTime: lastExecMinutes,
      userInteraction: 0 // Default to 0, can be enhanced later with user interaction tracking
    };
  }

  /**
   * Get active timers count
   */
  public getActiveTimersCount(): number {
    return this.debounceTimers.size;
  }

  /**
   * Get active timers for files
   */
  public getActiveTimers(): string[] {
    return Array.from(this.debounceTimers.keys());
  }

  /**
   * Check if file has active timer
   */
  public hasActiveTimer(filePath: string): boolean {
    return this.debounceTimers.has(filePath);
  }
}