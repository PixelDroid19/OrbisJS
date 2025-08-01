/**
 * Unit tests for ActionWorkflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionWorkflow } from './ActionWorkflow.js';
import { ActionExecutor } from './ActionExecutor.js';
import type {
  MCPAction,
  MCPContext,
  MCPProvider,
  ActionResult,
  MCPClientConfig
} from './types.js';

// Mock ActionExecutor
const mockActionExecutor = {
  initialize: vi.fn(),
  destroy: vi.fn(),
  executeAction: vi.fn(),
  rollbackAction: vi.fn(),
  rollbackLastAction: vi.fn(),
  rollbackMultipleActions: vi.fn(),
  getRollbackInfo: vi.fn(),
  getActionHistory: vi.fn(() => []),
  clearActionHistory: vi.fn(),
  getDetailedActionHistory: vi.fn(() => []),
  getRollbackStatistics: vi.fn(() => ({ totalSnapshots: 0, averageSnapshotSize: 0 })),
  registerCustomAction: vi.fn(),
  getAvailableActions: vi.fn(() => [])
} as unknown as ActionExecutor;

describe('ActionWorkflow', () => {
  let workflow: ActionWorkflow;
  let mockContext: MCPContext;
  let mockProviders: Map<string, MCPProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    workflow = new ActionWorkflow(mockActionExecutor);
    
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'function test() { return true; }',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false,
        path: 'test.js'
      },
      project: {
        structure: {},
        config: {},
        dependencies: []
      },
      execution: {
        history: [],
        environment: {}
      },
      user: {
        preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true },
        recentActions: [],
        activeFeatures: []
      }
    };

    mockProviders = new Map();
  });

  afterEach(async () => {
    await workflow.destroy();
  });

  describe('Batch Execution', () => {
    it('should execute batch of actions successfully', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: true, changes: [] })
        .mockResolvedValueOnce({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const batch = {
        id: 'test-batch-1',
        name: 'Test Batch',
        description: 'A test batch of actions',
        actions: [
          {
            id: 'action-1',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          },
          {
            id: 'action-2',
            type: 'optimize' as const,
            target: { type: 'function' as const, identifier: 'test' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: false,
        continueOnError: false
      };

      const result = await workflow.executeBatch(batch, mockContext, mockProviders);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.failedActions).toHaveLength(0);
      expect(result.rolledBackActions).toHaveLength(0);
      expect(mockExecuteAction).toHaveBeenCalledTimes(2);
    });

    it('should handle batch execution with failures', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: true, changes: [] })
        .mockResolvedValueOnce({ success: false, error: 'Action failed' });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const batch = {
        id: 'test-batch-2',
        name: 'Failing Batch',
        description: 'A batch with failures',
        actions: [
          {
            id: 'action-1',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          },
          {
            id: 'action-2',
            type: 'invalid-action' as any,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: false,
        continueOnError: true
      };

      const result = await workflow.executeBatch(batch, mockContext, mockProviders);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.failedActions).toContain('action-2');
      expect(result.error).toContain('1 actions failed');
    });

    it('should rollback on failure when configured', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: true, changes: [] })
        .mockResolvedValueOnce({ success: false, error: 'Action failed' });
      
      const mockRollbackAction = vi.fn().mockResolvedValue(true);
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;
      (mockActionExecutor.rollbackAction as any) = mockRollbackAction;

      const batch = {
        id: 'test-batch-3',
        name: 'Rollback Batch',
        description: 'A batch that should rollback on failure',
        actions: [
          {
            id: 'action-1',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          },
          {
            id: 'action-2',
            type: 'invalid-action' as any,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: true,
        continueOnError: false
      };

      const result = await workflow.executeBatch(batch, mockContext, mockProviders);

      expect(result.success).toBe(false);
      expect(result.rolledBackActions).toContain('action-1');
      expect(mockRollbackAction).toHaveBeenCalledWith('action-1');
    });

    it('should stop on first error when continueOnError is false', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: false, error: 'First action failed' });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const batch = {
        id: 'test-batch-4',
        name: 'Stop on Error Batch',
        description: 'A batch that stops on first error',
        actions: [
          {
            id: 'action-1',
            type: 'invalid-action' as any,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          },
          {
            id: 'action-2',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: false,
        continueOnError: false
      };

      const result = await workflow.executeBatch(batch, mockContext, mockProviders);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1); // Should stop after first failure
      expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transaction Management', () => {
    it('should start and manage transactions', () => {
      const actions = [
        {
          id: 'tx-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-1', actions);

      const transaction = workflow.getTransactionStatus('tx-1');
      expect(transaction).toBeDefined();
      expect(transaction?.id).toBe('tx-1');
      expect(transaction?.actions).toHaveLength(1);
      expect(transaction?.committed).toBe(false);
      expect(transaction?.rolledBack).toBe(false);
    });

    it('should execute actions in transaction', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const actions = [
        {
          id: 'tx-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-2', actions);
      const results = await workflow.executeInTransaction('tx-2', mockContext, mockProviders);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    });

    it('should commit successful transactions', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const actions = [
        {
          id: 'tx-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-3', actions);
      await workflow.executeInTransaction('tx-3', mockContext, mockProviders);
      
      const committed = await workflow.commitTransaction('tx-3');
      expect(committed).toBe(true);

      const transaction = workflow.getTransactionStatus('tx-3');
      expect(transaction?.committed).toBe(true);
    });

    it('should rollback transactions', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      const mockRollbackAction = vi.fn().mockResolvedValue(true);
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;
      (mockActionExecutor.rollbackAction as any) = mockRollbackAction;

      const actions = [
        {
          id: 'tx-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-4', actions);
      await workflow.executeInTransaction('tx-4', mockContext, mockProviders);
      
      const rolledBack = await workflow.rollbackTransaction('tx-4');
      expect(rolledBack).toBe(true);

      const transaction = workflow.getTransactionStatus('tx-4');
      expect(transaction?.rolledBack).toBe(true);
      expect(mockRollbackAction).toHaveBeenCalledWith('tx-action-1');
    });

    it('should prevent committing failed transactions', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: false, error: 'Action failed' });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const actions = [
        {
          id: 'tx-action-1',
          type: 'invalid-action' as any,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-5', actions);
      await workflow.executeInTransaction('tx-5', mockContext, mockProviders);
      
      await expect(workflow.commitTransaction('tx-5')).rejects.toThrow('contains failed actions');
    });

    it('should cleanup completed transactions', async () => {
      const actions = [
        {
          id: 'tx-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('tx-6', actions);
      await workflow.rollbackTransaction('tx-6');
      
      const cleaned = workflow.cleanupTransaction('tx-6');
      expect(cleaned).toBe(true);
      
      const transaction = workflow.getTransactionStatus('tx-6');
      expect(transaction).toBeNull();
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry failed actions', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: false, error: 'Temporary failure' })
        .mockResolvedValueOnce({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const action = {
        id: 'retry-action-1',
        type: 'format' as const,
        target: { type: 'file' as const, path: 'test.js' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await workflow.executeWithRetry(action, mockContext, mockProviders, 2, 10);

      expect(result.success).toBe(true);
      expect(mockExecuteAction).toHaveBeenCalledTimes(2);
    });

    it('should not retry validation errors', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: false, error: 'Action validation failed: Missing parameter' });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const action = {
        id: 'retry-action-2',
        type: 'refactor' as const,
        target: { type: 'selection' as const },
        parameters: {}, // Missing required parameter
        timestamp: new Date()
      };

      const result = await workflow.executeWithRetry(action, mockContext, mockProviders, 2, 10);

      expect(result.success).toBe(false);
      expect(mockExecuteAction).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should give up after max retries', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: false, error: 'Persistent failure' });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const action = {
        id: 'retry-action-3',
        type: 'format' as const,
        target: { type: 'file' as const, path: 'test.js' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await workflow.executeWithRetry(action, mockContext, mockProviders, 2, 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('failed after 3 attempts');
      expect(mockExecuteAction).toHaveBeenCalledTimes(3);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute actions in parallel', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const actions = [
        {
          id: 'parallel-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'file1.js' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'parallel-2',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'file2.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const results = await workflow.executeParallel(actions, mockContext, mockProviders);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockExecuteAction).toHaveBeenCalledTimes(2);
    });

    it('should handle parallel execution failures', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValueOnce({ success: true, changes: [] })
        .mockRejectedValueOnce(new Error('Parallel execution failed'));
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const actions = [
        {
          id: 'parallel-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'file1.js' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'parallel-2',
          type: 'invalid-action' as any,
          target: { type: 'file' as const, path: 'file2.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const results = await workflow.executeParallel(actions, mockContext, mockProviders);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Parallel execution failed');
    });
  });

  describe('Dependency Validation', () => {
    it('should validate action dependencies', () => {
      const actions = [
        {
          id: 'dep-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'dep-2',
          type: 'optimize' as const,
          target: { type: 'file' as const, path: 'other.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const validation = workflow.validateActionDependencies(actions);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect conflicting actions', () => {
      const actions = [
        {
          id: 'conflict-1',
          type: 'rename' as const,
          target: { type: 'function' as const, identifier: 'test' },
          parameters: { newName: 'newTest' },
          timestamp: new Date()
        },
        {
          id: 'conflict-2',
          type: 'delete' as any,
          target: { type: 'function' as const, identifier: 'test' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const validation = workflow.validateActionDependencies(actions);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Conflicting actions on function:test: rename and delete');
    });
  });

  describe('Composite Actions', () => {
    it('should create composite actions', () => {
      const actions = [
        {
          id: 'comp-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'comp-2',
          type: 'optimize' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const composite = workflow.createCompositeAction(
        'composite-1',
        'Format and Optimize',
        'Format code then optimize it',
        actions
      );

      expect(composite.id).toBe('composite-1');
      expect(composite.name).toBe('Format and Optimize');
      expect(composite.actions).toHaveLength(2);
      expect(composite.rollbackOnFailure).toBe(true);
    });
  });

  describe('History Management', () => {
    it('should maintain batch history', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const batch = {
        id: 'history-batch-1',
        name: 'History Test',
        description: 'Test batch for history',
        actions: [
          {
            id: 'history-action-1',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: false,
        continueOnError: false
      };

      await workflow.executeBatch(batch, mockContext, mockProviders);

      const history = workflow.getBatchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].batchId).toBe('history-batch-1');
    });

    it('should clear batch history', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;

      const batch = {
        id: 'clear-batch-1',
        name: 'Clear Test',
        description: 'Test batch for clearing',
        actions: [
          {
            id: 'clear-action-1',
            type: 'format' as const,
            target: { type: 'file' as const, path: 'test.js' },
            parameters: {},
            timestamp: new Date()
          }
        ],
        rollbackOnFailure: false,
        continueOnError: false
      };

      await workflow.executeBatch(batch, mockContext, mockProviders);
      expect(workflow.getBatchHistory()).toHaveLength(1);

      workflow.clearBatchHistory();
      expect(workflow.getBatchHistory()).toHaveLength(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup active transactions on destroy', async () => {
      const mockExecuteAction = vi.fn()
        .mockResolvedValue({ success: true, changes: [] });
      const mockRollbackAction = vi.fn().mockResolvedValue(true);
      
      (mockActionExecutor.executeAction as any) = mockExecuteAction;
      (mockActionExecutor.rollbackAction as unknown) = mockRollbackAction;

      const actions = [
        {
          id: 'cleanup-action-1',
          type: 'format' as const,
          target: { type: 'file' as const, path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      workflow.startTransaction('cleanup-tx-1', actions);
      // Execute the transaction to make it have results to rollback
      await workflow.executeInTransaction('cleanup-tx-1', mockContext, mockProviders);
      expect(workflow.getActiveTransactions()).toHaveLength(1);

      await workflow.destroy();
      expect(mockRollbackAction).toHaveBeenCalled();
    });
  });
});