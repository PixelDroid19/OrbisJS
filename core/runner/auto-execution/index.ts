/**
 * Auto-execution module exports
 */

export { AutoExecutionManager } from './AutoExecutionManager.js';

// Export individual components
export { SimpleCancellationToken } from './CancellationToken.js';
export { ExecutionQueue } from './ExecutionQueue.js';
export { FileWatcher } from './FileWatcher.js';
export { MetricsCollector } from './MetricsCollector.js';
export { IntelligentScheduler } from './IntelligentScheduler.js';
export { BatchProcessor } from './BatchProcessor.js';

export type * from './types.js';