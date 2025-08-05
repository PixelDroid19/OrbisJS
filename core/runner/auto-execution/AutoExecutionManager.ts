/**
 * AutoExecutionManager - Core functionality for automatic code execution
 * Componentized version using modular architecture
 */

import type { WebContainerRunner } from '../WebContainerRunner.js';
import type { ExecutionResult, SupportedLanguage } from '../types.js';
import type {
  ExecutionStrategy,
  WatchOptions,
  ExecutionStatus,
  ExecutionQueueEntry,
  FileChangeEvent,
  BeforeExecutionCallback,
  AfterExecutionCallback,
  ExecutionErrorCallback,
  AutoExecutionConfig,
  ExecutionMetrics,
  ExecutionProgress,
  BatchExecutionConfig,
  FileDependency,
  PriorityFactors
} from './types.js';

// Import components
import { SimpleCancellationToken } from './CancellationToken.js';
import { ExecutionQueue } from './ExecutionQueue.js';
import { FileWatcher } from './FileWatcher.js';
import { MetricsCollector } from './MetricsCollector.js';
import { IntelligentScheduler } from './IntelligentScheduler.js';
import { BatchProcessor } from './BatchProcessor.js';

/**
 * Default configuration for auto-execution
 */
const DEFAULT_CONFIG: AutoExecutionConfig = {
  enabled: true,
  strategy: {
    type: 'debounced',
    delay: 1000,
    priority: 'speed',
    batchSize: 5,
    batchWindow: 2000,
    dependencyResolution: true
  },
  watchPatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  debounceDelay: 1000,
  maxRetries: 3,
  maxQueueSize: 50
};

/**
 * Default batch execution configuration
 */
const DEFAULT_BATCH_CONFIG: BatchExecutionConfig = {
  maxBatchSize: 10,
  batchWindow: 2000,
  dependencyResolution: true,
  parallelExecution: false // Sequential execution for better error tracking
};

/**
 * AutoExecutionManager - Manages automatic code execution with file watching
 * Now using componentized architecture for better maintainability
 */
export class AutoExecutionManager {
  private _runner: WebContainerRunner;
  private config: AutoExecutionConfig;
  private cancellationToken: SimpleCancellationToken | null = null;
  
  // Components
  private executionQueue: ExecutionQueue;
  private fileWatcher: FileWatcher;
  private metricsCollector: MetricsCollector;
  private intelligentScheduler: IntelligentScheduler;
  private batchProcessor: BatchProcessor;
  
  // Event callbacks
  private beforeExecutionCallbacks: BeforeExecutionCallback[] = [];
  private afterExecutionCallbacks: AfterExecutionCallback[] = [];
  private executionErrorCallbacks: ExecutionErrorCallback[] = [];

  constructor(runner: WebContainerRunner, config: Partial<AutoExecutionConfig> = {}) {
    this._runner = runner;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize components
    this.executionQueue = new ExecutionQueue(this.config.maxQueueSize);
    this.fileWatcher = new FileWatcher(this.config.watchPatterns, this.config.ignorePatterns);
    this.metricsCollector = new MetricsCollector();
    this.intelligentScheduler = new IntelligentScheduler(this.metricsCollector);
    this.batchProcessor = new BatchProcessor(DEFAULT_BATCH_CONFIG, this.metricsCollector);
    
    // Connect progress callbacks
    this.executionQueue.onProgress(this.reportProgress.bind(this));
  }

  /**
   * Enable auto-execution
   */
  public enable(): void {
    this.config.enabled = true;
    console.log('🔄 Auto-execution enabled');
  }

  /**
   * Disable auto-execution
   */
  public disable(): void {
    this.config.enabled = false;
    this.clearQueue();
    this.clearAllTimers();
    console.log('⏸️ Auto-execution disabled');
  }

  /**
   * Check if auto-execution is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the runner instance
   */
  public get runner(): WebContainerRunner {
    return this._runner;
  }

  /**
   * Watch a specific file for changes
   */
  public watchFile(filePath: string, options: WatchOptions = {}): void {
    const watchOptions = { ...options, debounceDelay: options.debounceDelay || this.config.debounceDelay };
    this.fileWatcher.watchFile(filePath, watchOptions);
  }

  /**
   * Stop watching a specific file
   */
  public unwatchFile(filePath: string): void {
    this.fileWatcher.unwatchFile(filePath);
    this.intelligentScheduler.clearDebounceTimer(filePath);
  }

  /**
   * Watch a directory for changes
   */
  public watchDirectory(dirPath: string, options: WatchOptions = {}): void {
    const watchOptions = { 
      ...options, 
      debounceDelay: options.debounceDelay || this.config.debounceDelay,
      recursive: options.recursive !== false // Default to true
    };
    this.fileWatcher.watchDirectory(dirPath, watchOptions);
  }

  /**
   * Set execution strategy
   */
  public setExecutionStrategy(strategy: ExecutionStrategy): void {
    this.config.strategy = strategy;
    console.log(`⚙️ Execution strategy updated:`, strategy);
  }

  /**
   * Set debounce delay
   */
  public setDebounceDelay(milliseconds: number): void {
    this.config.debounceDelay = milliseconds;
    console.log(`⏱️ Debounce delay set to ${milliseconds}ms`);
  }

  /**
   * Handle file change events
   */
  public handleFileChange(event: FileChangeEvent): void {
    console.log('🔍 AutoExecutionManager.handleFileChange called:', {
      filePath: event.filePath,
      changeType: event.changeType,
      enabled: this.config.enabled,
      runnerReady: this._runner.isReady(),
      watchedFiles: Array.from(this.fileWatcher.getWatchedFiles().keys()),
      watchedDirectories: Array.from(this.fileWatcher.getWatchedDirectories().keys())
    });

    if (!this.config.enabled) {
      console.log('⚠️ Auto-execution is disabled, ignoring file change');
      return;
    }

    if (!this._runner.isReady()) {
      console.log('⚠️ Runner is not ready, ignoring file change');
      return;
    }

    // Normalize file path for UI files
    let normalizedFilePath = event.filePath;
    
    // If the file path doesn't start with '/', it's likely from the UI editor
    // and should be treated as being in the /src directory
    if (!normalizedFilePath.startsWith('/')) {
      normalizedFilePath = `/src/${normalizedFilePath}`;
      console.log('📁 Normalized file path from UI:', {
        original: event.filePath,
        normalized: normalizedFilePath
      });
    }

    // Check if file should be ignored
    if (this.fileWatcher.shouldIgnoreFile(normalizedFilePath)) {
      console.log('⚠️ File should be ignored:', normalizedFilePath);
      return;
    }

    // Check if file is being watched
    const isWatched = this.fileWatcher.isFileWatched(normalizedFilePath);
    console.log('👁️ File watch check:', {
      originalPath: event.filePath,
      normalizedPath: normalizedFilePath,
      isWatched,
      watchedFiles: Array.from(this.fileWatcher.getWatchedFiles().keys()),
      watchedDirectories: Array.from(this.fileWatcher.getWatchedDirectories().keys())
    });

    if (!isWatched) {
      console.log('⚠️ File is not being watched:', normalizedFilePath);
      return;
    }

    // Update the event with normalized path
    const normalizedEvent = {
      ...event,
      filePath: normalizedFilePath
    };

    console.log(`📝 File changed: ${normalizedEvent.filePath} (${normalizedEvent.changeType})`);

    // Update change frequency tracking
    this.metricsCollector.updateChangeFrequency(normalizedEvent.filePath);

    // Handle based on execution strategy
    switch (this.config.strategy.type) {
      case 'immediate':
        console.log('⚡ Scheduling immediate execution');
        this.scheduleExecution(normalizedEvent);
        break;
      case 'debounced':
        console.log('⏱️ Scheduling debounced execution');
        this.scheduleDebounced(normalizedEvent);
        break;
      case 'batch':
        console.log('📦 Scheduling batch execution');
        this.scheduleBatch(normalizedEvent);
        break;
      case 'manual':
        // Manual execution - just log the change
        console.log(`📋 File change logged for manual execution: ${normalizedEvent.filePath}`);
        break;
    }
  }

  /**
   * Execute code immediately (manual trigger)
   */
  public async executeNow(filePath?: string, content?: string): Promise<ExecutionResult> {
    console.log('🚀 executeNow called with:', { filePath, hasContent: !!content, runnerReady: this._runner.isReady() });
    
    if (!this._runner.isReady()) {
      const error = 'WebContainerRunner is not ready';
      console.error('❌', error);
      throw new Error(error);
    }

    if (filePath) {
      // Execute specific file
      const language = this.detectLanguage(filePath);
      const code = content || '';
      console.log('📝 Creating execution entry for:', { filePath, language, codeLength: code.length });
      const entry = this.createExecutionEntry(filePath, code, language);
      console.log('⚡ Executing entry:', entry.id);
      return this.executeEntry(entry);
    } else {
      const currentExecution = this.executionQueue.getCurrentExecution();
      if (currentExecution) {
        // Re-execute current file
        console.log('🔄 Re-executing current file:', currentExecution.filePath);
        return this.executeEntry(currentExecution);
      } else {
        const error = 'No file specified and no current execution';
        console.error('❌', error);
        throw new Error(error);
      }
    }
  }

  /**
   * Cancel current execution with enhanced cleanup
   */
  public cancelExecution(): void {
    console.log('🛑 Cancelling execution...');
    
    // Cancel current execution
    if (this.cancellationToken) {
      this.cancellationToken.cancel();
    }
    
    // Clear all queues and timers
    this.clearQueue();
    this.clearAllTimers();
    this.batchProcessor.clearActiveBatches();
    
    // Reset processing state
    this.executionQueue.setProcessing(false);
    this.executionQueue.setCurrentExecution(null);
    
    // Report cancellation progress
    this.reportProgress({
      current: 0,
      total: 0,
      stage: 'cancelled',
      message: 'Execution cancelled by user'
    });
    
    console.log('✅ Execution cancelled and cleaned up');
  }

  /**
   * Cancel specific file execution
   */
  public cancelFileExecution(filePath: string): boolean {
    let removed = false;
    
    // Remove from queue
    if (this.executionQueue.removeFile(filePath)) {
      removed = true;
    }
    
    // Clear debounce timer
    this.intelligentScheduler.clearDebounceTimer(filePath);
    
    // Remove from active batches
    if (this.batchProcessor.removeFileFromBatches(filePath)) {
      removed = true;
    }
    
    if (removed) {
      console.log(`🛑 Cancelled execution for ${filePath}`);
    }
    
    return removed;
  }

  /**
   * Get current execution status
   */
  public getExecutionStatus(): ExecutionStatus {
    const queueStatus = this.executionQueue.getStatus();
    const metrics = this.metricsCollector.getMetrics();
    
    return {
      isRunning: queueStatus.isProcessing,
      currentFile: queueStatus.currentFile,
      queuedFiles: queueStatus.queuedFiles,
      lastExecution: metrics.lastExecutionTime,
      executionCount: metrics.totalExecutions
    };
  }

  /**
   * Get execution metrics
   */
  public getMetrics(): ExecutionMetrics {
    return this.metricsCollector.getMetrics();
  }

  /**
   * Register before execution callback
   */
  public onBeforeExecution(callback: BeforeExecutionCallback): void {
    this.beforeExecutionCallbacks.push(callback);
  }

  /**
   * Register after execution callback
   */
  public onAfterExecution(callback: AfterExecutionCallback): void {
    this.afterExecutionCallbacks.push(callback);
  }

  /**
   * Register execution error callback
   */
  public onExecutionError(callback: ExecutionErrorCallback): void {
    this.executionErrorCallbacks.push(callback);
  }

  /**
   * Register progress callback
   */
  public onProgress(callback: (progress: ExecutionProgress) => void): void {
    this.executionQueue.onProgress(callback);
  }

  /**
   * Set batch execution configuration
   */
  public setBatchConfig(config: Partial<BatchExecutionConfig>): void {
    this.batchProcessor.setBatchConfig(config);
  }

  /**
   * Get batch execution configuration
   */
  public getBatchConfig(): BatchExecutionConfig {
    return this.batchProcessor.getBatchConfig();
  }

  /**
   * Get file dependencies
   */
  public getFileDependencies(): Map<string, FileDependency> {
    return this.metricsCollector.getFileDependencies();
  }

  /**
   * Get file change frequencies
   */
  public getFileChangeFrequencies(): Map<string, number> {
    return this.metricsCollector.getFileChangeFrequencies();
  }

  /**
   * Get active batches
   */
  public getActiveBatches(): Map<string, ExecutionQueueEntry[]> {
    return this.batchProcessor.getActiveBatches();
  }

  /**
   * Force process all pending batches
   */
  public async flushBatches(): Promise<void> {
    await this.batchProcessor.flushBatches((entries) => {
      entries.forEach(entry => this.executionQueue.add(entry));
      this.processQueue();
    });
  }

  /**
   * Get priority factors for a file
   */
  public getPriorityFactors(filePath: string): PriorityFactors {
    return this.intelligentScheduler.calculatePriorityFactors(filePath);
  }

  /**
   * Private: Schedule immediate execution
   */
  private scheduleExecution(event: FileChangeEvent): void {
    if (event.changeType === 'deleted') {
      return; // Don't execute deleted files
    }

    const entry = this.createExecutionEntry(
      event.filePath,
      event.content || '',
      this.detectLanguage(event.filePath)
    );

    this.executionQueue.add(entry);
    this.processQueue();
  }

  /**
   * Private: Schedule debounced execution with intelligent delay calculation
   */
  private scheduleDebounced(event: FileChangeEvent): void {
    // Cancel any existing queued or running execution for the same file
    this.cancelFileExecution(event.filePath);
    const currentExecution = this.executionQueue.getCurrentExecution();
    if (currentExecution?.filePath === event.filePath) {
      this.cancelExecution();
    }

    const baseDelay = this.config.strategy.delay || this.config.debounceDelay;
    
    // Schedule with intelligent delay
    this.intelligentScheduler.scheduleDebounced(event, baseDelay, () => {
      this.scheduleExecution(event);
    });
  }

  /**
   * Private: Schedule batch execution
   */
  private scheduleBatch(event: FileChangeEvent): void {
    this.batchProcessor.scheduleBatch(
      event,
      (filePath, content, language) => this.createExecutionEntry(filePath, content, language),
      (filePath) => this.detectLanguage(filePath),
      (entries) => {
        entries.forEach(entry => this.executionQueue.add(entry));
        this.processQueue();
      }
    );
  }

  /**
   * Private: Process execution queue
   */
  private async processQueue(): Promise<void> {
    if (this.executionQueue.isProcessingQueue() || this.executionQueue.isEmpty()) {
      return;
    }

    this.executionQueue.setProcessing(true);
    console.log(`🔄 Processing execution queue (${this.executionQueue.size()} entries)`);

    const startTime = Date.now();

    while (!this.executionQueue.isEmpty()) {
      const entry = this.executionQueue.next();
      if (!entry) break;

      this.executionQueue.setCurrentExecution(entry);
      
      try {
        await this.executeEntry(entry);
      } catch (error) {
        console.error(`❌ Error executing ${entry.filePath}:`, error);
      }

      // Check for cancellation
      if (this.cancellationToken?.isCancelled) {
        console.log('🛑 Queue processing cancelled');
        break;
      }
    }

    this.executionQueue.setProcessing(false);
    this.executionQueue.setCurrentExecution(null);
    
    const processingTime = Date.now() - startTime;
    this.metricsCollector.setQueueProcessingTime(processingTime);
    
    console.log(`✅ Queue processing completed in ${processingTime}ms`);
  }

  /**
   * Private: Execute a single entry
   */
  private async executeEntry(entry: ExecutionQueueEntry): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Create new cancellation token for this execution
      this.cancellationToken = new SimpleCancellationToken();

      // Call before execution callbacks
      for (const callback of this.beforeExecutionCallbacks) {
        if (this.cancellationToken.isCancelled) break;
        await callback(entry);
      }

      // Check for cancellation before execution
      if (this.cancellationToken.isCancelled) {
        return this.createCancelledResult();
      }

      // Execute the code
      const result = await this.executeWithTimeout(entry);
      const duration = Date.now() - startTime;
      
      // Check for cancellation after execution
      if (this.cancellationToken.isCancelled) {
        return this.createCancelledResult();
      }
      
      // Update metrics and tracking
      if (result.success) {
        this.metricsCollector.recordSuccess(entry.filePath, duration);
      } else {
        this.metricsCollector.recordFailure(entry.filePath, duration);
      }

      // Call after execution callbacks
      for (const callback of this.afterExecutionCallbacks) {
        if (this.cancellationToken.isCancelled) break;
        await callback(entry, result);
      }

      console.log(`✅ Executed ${entry.filePath} in ${duration}ms`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: ExecutionResult = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration,
        timestamp: new Date()
      };

      // Update metrics
      this.metricsCollector.recordFailure(entry.filePath, duration);

      // Call error callbacks
      for (const callback of this.executionErrorCallbacks) {
        if (this.cancellationToken?.isCancelled) break;
        await callback(entry, error instanceof Error ? error : new Error('Unknown error'));
      }

      // Retry logic (only if not cancelled)
      if (!this.cancellationToken?.isCancelled && entry.retryCount < this.config.maxRetries) {
        entry.retryCount++;
        console.log(`🔄 Retrying execution for ${entry.filePath} (attempt ${entry.retryCount}/${this.config.maxRetries})`);
        this.executionQueue.add(entry);
      } else if (entry.retryCount >= this.config.maxRetries) {
        console.error(`❌ Max retries exceeded for ${entry.filePath}`);
      }

      return errorResult;
    }
  }

  /**
   * Private: Execute code with timeout and cancellation support
   */
  private async executeWithTimeout(entry: ExecutionQueueEntry): Promise<ExecutionResult> {
    const timeout = 30000; // 30 second timeout for long-running processes
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ Execution timeout for ${entry.filePath} after ${timeout}ms`);
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);
      
      // Set up cancellation
      const cancellationCallback = () => {
        clearTimeout(timeoutId);
        console.log(`🛑 Execution cancelled for ${entry.filePath}`);
        resolve(this.createCancelledResult());
      };
      
      if (this.cancellationToken) {
        this.cancellationToken.onCancelled(cancellationCallback);
      }
      
      // Execute the code
      // Extract just the filename from the full path for the runner
      const filename = entry.filePath.split('/').pop() || 'main.js';
      console.log('🎯 Executing with filename:', filename, 'from path:', entry.filePath);
      
      this._runner.runCode(
        entry.code,
        entry.language as SupportedLanguage,
        { filename }
      ).then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      }).catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Private: Create a cancelled execution result
   */
  private createCancelledResult(): ExecutionResult {
    return {
      success: false,
      output: '',
      error: 'Execution cancelled',
      duration: 0,
      timestamp: new Date()
    };
  }

  /**
   * Private: Create execution entry
   */
  private createExecutionEntry(filePath: string, code: string, language: string): ExecutionQueueEntry {
    const priority = this.calculatePriority(filePath);
    
    return {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filePath,
      code,
      language,
      priority,
      timestamp: new Date(),
      retryCount: 0
    };
  }

  /**
   * Private: Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'mjs':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'jsx':
        return 'javascript';
      case 'tsx':
        return 'typescript';
      case 'py':
        return 'python';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      default:
        return 'javascript'; // Default fallback
    }
  }

  /**
   * Private: Calculate execution priority
   */
  private calculatePriority(filePath: string): number {
    const factors = this.intelligentScheduler.calculatePriorityFactors(filePath);
    
    // Weighted priority calculation
    const priority = 
      factors.fileImportance * 0.4 +
      factors.dependencyWeight * 0.3 +
      (10 - Math.min(10, factors.changeFrequency)) * 0.2 +
      Math.min(10, factors.lastExecutionTime) * 0.1;
    
    return Math.max(1, Math.min(10, Math.round(priority)));
  }

  /**
   * Private: Clear execution queue
   */
  private clearQueue(): void {
    this.executionQueue.clear();
  }

  /**
   * Private: Clear all timers
   */
  private clearAllTimers(): void {
    this.intelligentScheduler.clearAllTimers();
    this.batchProcessor.clearBatchTimers();
  }

  /**
   * Private: Report execution progress
   */
  private reportProgress(progress: ExecutionProgress): void {
    // Progress is already handled by ExecutionQueue component
    // This method serves as a bridge for the callback binding
    console.log(`📊 Progress: ${progress.current}/${progress.total} - ${progress.stage}`);
  }
}