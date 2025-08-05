/**
 * Types for AutoExecutionManager
 * Defines interfaces for file watching, execution strategies, and status tracking
 */

import type { ExecutionResult } from '../types.js';

// Execution strategies
export interface ExecutionStrategy {
  type: 'immediate' | 'debounced' | 'batch' | 'manual';
  delay?: number;
  batchSize?: number;
  batchWindow?: number; // Time window for collecting batch items
  priority?: 'speed' | 'accuracy';
  dependencyResolution?: boolean; // Enable dependency-based execution ordering
}

// Watch options for file monitoring
export interface WatchOptions {
  debounceDelay?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  recursive?: boolean;
}

// Execution status tracking
export interface ExecutionStatus {
  isRunning: boolean;
  currentFile?: string;
  queuedFiles: string[];
  lastExecution?: Date;
  executionCount: number;
}

// Execution queue entry
export interface ExecutionQueueEntry {
  id: string;
  filePath: string;
  code: string;
  language: string;
  timestamp: Date;
  retryCount: number;
  priority: number;
  dependencies?: string[]; // Files this entry depends on
  changeFrequency?: number; // How often this file changes
  lastExecutionTime?: Date; // When this file was last executed
  batchId?: string; // ID for batch execution grouping
}

// File change event
export interface FileChangeEvent {
  filePath: string;
  changeType: 'created' | 'modified' | 'deleted';
  content?: string;
  timestamp: Date;
}

// Execution callbacks
export type BeforeExecutionCallback = (entry: ExecutionQueueEntry) => Promise<boolean> | boolean;
export type AfterExecutionCallback = (entry: ExecutionQueueEntry, result: ExecutionResult) => Promise<void> | void;
export type ExecutionErrorCallback = (entry: ExecutionQueueEntry, error: Error) => Promise<void> | void;

// Auto-execution configuration
export interface AutoExecutionConfig {
  enabled: boolean;
  strategy: ExecutionStrategy;
  watchPatterns: string[];
  ignorePatterns: string[];
  debounceDelay: number;
  maxRetries: number;
  maxQueueSize: number;
}

// Execution metrics
export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  queueProcessingTime: number;
  lastExecutionTime?: Date;
}

// Progress reporting
export interface ExecutionProgress {
  current: number;
  total: number;
  currentFile?: string;
  stage: 'queued' | 'executing' | 'completed' | 'cancelled' | 'error';
  message?: string;
  batchId?: string;
  estimatedTimeRemaining?: number;
}

// Enhanced cancellation token interface
export interface CancellationToken {
  isCancelled: boolean;
  cancel(): void;
  onCancelled(callback: () => void): void;
}

// Batch execution configuration
export interface BatchExecutionConfig {
  maxBatchSize: number;
  batchWindow: number; // Time window in ms to collect batch items
  dependencyResolution: boolean;
  parallelExecution: boolean;
}

// File dependency information
export interface FileDependency {
  filePath: string;
  dependencies: string[];
  dependents: string[];
  lastModified: Date;
  changeFrequency: number;
}

// Execution priority factors
export interface PriorityFactors {
  fileImportance: number; // Based on file type and name patterns
  changeFrequency: number; // How often the file changes
  dependencyWeight: number; // How many files depend on this one
  lastExecutionTime: number; // Time since last execution
  userInteraction: number; // Recent user interaction with the file
}