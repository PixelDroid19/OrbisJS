/**
 * MetricsCollector - Collects and manages execution metrics
 */

import type { ExecutionMetrics, FileDependency } from './types.js';

export class MetricsCollector {
  private metrics: ExecutionMetrics;
  private fileDependencies: Map<string, FileDependency> = new Map();
  private fileChangeFrequency: Map<string, number> = new Map();
  private lastExecutionTimes: Map<string, Date> = new Map();
  private executionTimes: number[] = [];

  constructor() {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      queueProcessingTime: 0
    };
  }

  /**
   * Record successful execution
   */
  public recordSuccess(filePath: string, executionTime: number): void {
    this.metrics.totalExecutions++;
    this.metrics.successfulExecutions++;
    this.recordExecutionTime(executionTime);
    this.lastExecutionTimes.set(filePath, new Date());
    
    console.log(`✅ Execution success recorded for ${filePath} (${executionTime}ms)`);
  }

  /**
   * Record failed execution
   */
  public recordFailure(filePath: string, executionTime: number): void {
    this.metrics.totalExecutions++;
    this.metrics.failedExecutions++;
    this.recordExecutionTime(executionTime);
    this.lastExecutionTimes.set(filePath, new Date());
    
    console.log(`❌ Execution failure recorded for ${filePath} (${executionTime}ms)`);
  }

  /**
   * Update file change frequency
   */
  public updateChangeFrequency(filePath: string): void {
    const current = this.fileChangeFrequency.get(filePath) || 0;
    this.fileChangeFrequency.set(filePath, current + 1);
  }

  /**
   * Get file change frequency
   */
  public getChangeFrequency(filePath: string): number {
    return this.fileChangeFrequency.get(filePath) || 0;
  }

  /**
   * Get last execution time for file
   */
  public getLastExecutionTime(filePath: string): Date | undefined {
    return this.lastExecutionTimes.get(filePath);
  }

  /**
   * Get minutes since last execution
   */
  public getMinutesSinceLastExecution(filePath: string): number {
    const lastTime = this.lastExecutionTimes.get(filePath);
    if (!lastTime) return Infinity;
    
    return (Date.now() - lastTime.getTime()) / (1000 * 60);
  }

  /**
   * Set file dependency
   */
  public setFileDependency(filePath: string, dependency: FileDependency): void {
    this.fileDependencies.set(filePath, dependency);
  }

  /**
   * Get file dependency
   */
  public getFileDependency(filePath: string): FileDependency | undefined {
    return this.fileDependencies.get(filePath);
  }

  /**
   * Get all file dependencies
   */
  public getFileDependencies(): Map<string, FileDependency> {
    return new Map(this.fileDependencies);
  }

  /**
   * Get file change frequencies
   */
  public getFileChangeFrequencies(): Map<string, number> {
    return new Map(this.fileChangeFrequency);
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ExecutionMetrics {
    return { 
      ...this.metrics,
      lastExecutionTime: this.getLatestExecutionTime()
    };
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      queueProcessingTime: 0
    };
    this.executionTimes = [];
    console.log('📊 Metrics reset');
  }

  /**
   * Set queue processing time
   */
  public setQueueProcessingTime(time: number): void {
    this.metrics.queueProcessingTime = time;
  }

  /**
   * Get success rate
   */
  public getSuccessRate(): number {
    if (this.metrics.totalExecutions === 0) return 0;
    return (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
  }

  /**
   * Get failure rate
   */
  public getFailureRate(): number {
    if (this.metrics.totalExecutions === 0) return 0;
    return (this.metrics.failedExecutions / this.metrics.totalExecutions) * 100;
  }

  /**
   * Private: Record execution time and update average
   */
  private recordExecutionTime(time: number): void {
    this.executionTimes.push(time);
    
    // Keep only last 100 execution times for rolling average
    if (this.executionTimes.length > 100) {
      this.executionTimes.shift();
    }
    
    // Calculate average
    const sum = this.executionTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageExecutionTime = sum / this.executionTimes.length;
  }

  /**
   * Private: Get latest execution time
   */
  private getLatestExecutionTime(): Date | undefined {
    let latest: Date | undefined;
    
    for (const time of this.lastExecutionTimes.values()) {
      if (!latest || time > latest) {
        latest = time;
      }
    }
    
    return latest;
  }
}