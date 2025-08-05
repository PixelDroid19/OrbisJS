/**
 * ExecutionQueue - Manages execution queue operations
 */

import type { ExecutionQueueEntry, ExecutionProgress } from './types.js';

export class ExecutionQueue {
  private queue: ExecutionQueueEntry[] = [];
  private isProcessing = false;
  private currentExecution: ExecutionQueueEntry | null = null;
  private maxQueueSize: number;
  
  // Progress tracking
  private progressCallbacks: ((progress: ExecutionProgress) => void)[] = [];

  constructor(maxQueueSize: number = 50) {
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * Add entry to queue
   */
  public add(entry: ExecutionQueueEntry): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`⚠️ Execution queue is full (${this.maxQueueSize}), dropping oldest entry`);
      this.queue.shift();
    }

    // Remove existing entry for the same file to avoid duplicates
    this.queue = this.queue.filter(e => e.filePath !== entry.filePath);
    
    this.queue.push(entry);
    console.log(`📋 Added to execution queue: ${entry.filePath} (queue size: ${this.queue.length})`);
    return true;
  }

  /**
   * Get next entry from queue
   */
  public next(): ExecutionQueueEntry | null {
    return this.queue.shift() || null;
  }

  /**
   * Remove entries for specific file
   */
  public removeFile(filePath: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(entry => entry.filePath !== filePath);
    return initialLength !== this.queue.length;
  }

  /**
   * Clear entire queue
   */
  public clear(): void {
    this.queue = [];
    this.currentExecution = null;
    this.isProcessing = false;
    console.log('🗑️ Execution queue cleared');
  }

  /**
   * Get queue status
   */
  public getStatus() {
    return {
      size: this.queue.length,
      isProcessing: this.isProcessing,
      currentFile: this.currentExecution?.filePath,
      queuedFiles: this.queue.map(entry => entry.filePath)
    };
  }

  /**
   * Set processing state
   */
  public setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  /**
   * Set current execution
   */
  public setCurrentExecution(entry: ExecutionQueueEntry | null): void {
    this.currentExecution = entry;
  }

  /**
   * Get current execution
   */
  public getCurrentExecution(): ExecutionQueueEntry | null {
    return this.currentExecution;
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Get queue size
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Register progress callback
   */
  public onProgress(callback: (progress: ExecutionProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Report progress
   */
  public reportProgress(progress: ExecutionProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  /**
   * Get all queued entries
   */
  public getEntries(): ExecutionQueueEntry[] {
    return [...this.queue];
  }

  /**
   * Check if processing
   */
  public isProcessingQueue(): boolean {
    return this.isProcessing;
  }
}