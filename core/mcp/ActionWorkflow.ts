/**
 * Action Workflow - Orchestrates complex action execution workflows
 * Provides batch operations, transaction-like behavior, and advanced undo capabilities
 */

import type {
  MCPAction,
  MCPActionId,
  ActionResult,
  MCPContext,
  MCPProvider,
  MCPProviderId,
  CodeChange
} from './types.js';

import { ActionExecutor } from './ActionExecutor.js';

export interface ActionBatch {
  id: string;
  name: string;
  description: string;
  actions: MCPAction[];
  rollbackOnFailure: boolean;
  continueOnError: boolean;
}

export interface BatchResult {
  batchId: string;
  success: boolean;
  results: ActionResult[];
  failedActions: MCPActionId[];
  rolledBackActions: MCPActionId[];
  error?: string;
  executionTime: number;
}

export interface ActionTransaction {
  id: string;
  actions: MCPAction[];
  results: ActionResult[];
  committed: boolean;
  rolledBack: boolean;
  timestamp: Date;
}

export class ActionWorkflow {
  private actionExecutor: ActionExecutor;
  private activeTransactions: Map<string, ActionTransaction> = new Map();
  private batchHistory: BatchResult[] = [];

  constructor(actionExecutor: ActionExecutor) {
    this.actionExecutor = actionExecutor;
  }

  // Execute a batch of actions with transaction-like behavior
  async executeBatch(
    batch: ActionBatch,
    context: MCPContext,
    providers: Map<MCPProviderId, MCPProvider>
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: ActionResult[] = [];
    const failedActions: MCPActionId[] = [];
    const rolledBackActions: MCPActionId[] = [];

    try {
      // Execute actions sequentially
      for (const action of batch.actions) {
        try {
          const result = await this.actionExecutor.executeAction(action, context, providers);
          results.push(result);

          if (!result.success) {
            failedActions.push(action.id);

            if (!batch.continueOnError) {
              // Stop execution on first failure
              break;
            }
          }
        } catch (error) {
          const errorResult: ActionResult = {
            success: false,
            error: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
          results.push(errorResult);
          failedActions.push(action.id);

          if (!batch.continueOnError) {
            break;
          }
        }
      }

      // Handle rollback if needed
      if (failedActions.length > 0 && batch.rollbackOnFailure) {
        // Rollback successful actions in reverse order
        const successfulActions = batch.actions
          .slice(0, results.length)
          .filter((_, index) => results[index].success);

        for (let i = successfulActions.length - 1; i >= 0; i--) {
          const action = successfulActions[i];
          try {
            const rollbackSuccess = await this.actionExecutor.rollbackAction(action.id);
            if (rollbackSuccess) {
              rolledBackActions.push(action.id);
            }
          } catch (error) {
            console.error(`Failed to rollback action ${action.id}:`, error);
          }
        }
      }

      const batchResult: BatchResult = {
        batchId: batch.id,
        success: failedActions.length === 0,
        results,
        failedActions,
        rolledBackActions,
        executionTime: Date.now() - startTime
      };

      if (failedActions.length > 0) {
        batchResult.error = `${failedActions.length} actions failed`;
      }

      this.batchHistory.push(batchResult);
      return batchResult;

    } catch (error) {
      return {
        batchId: batch.id,
        success: false,
        results,
        failedActions,
        rolledBackActions,
        error: `Batch execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  // Start a transaction for a group of actions
  startTransaction(transactionId: string, actions: MCPAction[]): void {
    const transaction: ActionTransaction = {
      id: transactionId,
      actions: [...actions],
      results: [],
      committed: false,
      rolledBack: false,
      timestamp: new Date()
    };

    this.activeTransactions.set(transactionId, transaction);
  }

  // Execute actions within a transaction
  async executeInTransaction(
    transactionId: string,
    context: MCPContext,
    providers: Map<MCPProviderId, MCPProvider>
  ): Promise<ActionResult[]> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.committed || transaction.rolledBack) {
      throw new Error(`Transaction ${transactionId} is already ${transaction.committed ? 'committed' : 'rolled back'}`);
    }

    const results: ActionResult[] = [];

    for (const action of transaction.actions) {
      try {
        const result = await this.actionExecutor.executeAction(action, context, providers);
        results.push(result);
        transaction.results.push(result);

        if (!result.success) {
          // Transaction failed, prepare for rollback
          break;
        }
      } catch (error) {
        const errorResult: ActionResult = {
          success: false,
          error: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
        results.push(errorResult);
        transaction.results.push(errorResult);
        break;
      }
    }

    return results;
  }

  // Commit a transaction (makes changes permanent)
  async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.rolledBack) {
      throw new Error(`Transaction ${transactionId} has been rolled back and cannot be committed`);
    }

    // Check if all actions were successful
    const allSuccessful = transaction.results.every(result => result.success);
    if (!allSuccessful) {
      throw new Error(`Transaction ${transactionId} contains failed actions and cannot be committed`);
    }

    transaction.committed = true;
    return true;
  }

  // Rollback a transaction
  async rollbackTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (transaction.committed) {
      throw new Error(`Transaction ${transactionId} has been committed and cannot be rolled back`);
    }

    // Rollback successful actions in reverse order
    const successfulActions = transaction.actions
      .slice(0, transaction.results.length)
      .filter((_, index) => transaction.results[index]?.success);

    let rollbackCount = 0;
    for (let i = successfulActions.length - 1; i >= 0; i--) {
      const action = successfulActions[i];
      try {
        const rollbackSuccess = await this.actionExecutor.rollbackAction(action.id);
        if (rollbackSuccess) {
          rollbackCount++;
        }
      } catch (error) {
        console.error(`Failed to rollback action ${action.id} in transaction ${transactionId}:`, error);
      }
    }

    transaction.rolledBack = true;
    return rollbackCount === successfulActions.length;
  }

  // Get transaction status
  getTransactionStatus(transactionId: string): ActionTransaction | null {
    return this.activeTransactions.get(transactionId) || null;
  }

  // Clean up completed transactions
  cleanupTransaction(transactionId: string): boolean {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      return false;
    }

    if (!transaction.committed && !transaction.rolledBack) {
      return false; // Transaction is still active
    }

    return this.activeTransactions.delete(transactionId);
  }

  // Execute actions with automatic retry on failure
  async executeWithRetry(
    action: MCPAction,
    context: MCPContext,
    providers: Map<MCPProviderId, MCPProvider>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<ActionResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.actionExecutor.executeAction(action, context, providers);
        
        if (result.success) {
          return result;
        }

        lastError = result.error;

        // Don't retry if it's a validation error
        if (result.error?.includes('validation failed') || result.error?.includes('Missing required parameter')) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          await this.delay(retryDelay * (attempt + 1)); // Exponential backoff
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay * (attempt + 1));
        }
      }
    }

    return {
      success: false,
      error: `Action failed after ${maxRetries + 1} attempts. Last error: ${lastError}`
    };
  }

  // Execute actions in parallel (for independent actions)
  async executeParallel(
    actions: MCPAction[],
    context: MCPContext,
    providers: Map<MCPProviderId, MCPProvider>
  ): Promise<ActionResult[]> {
    const promises = actions.map(action =>
      this.actionExecutor.executeAction(action, context, providers)
        .catch(error => ({
          success: false as const,
          error: `Parallel execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }))
    );

    return Promise.all(promises);
  }

  // Create a composite action from multiple actions
  createCompositeAction(
    id: MCPActionId,
    name: string,
    description: string,
    actions: MCPAction[]
  ): ActionBatch {
    return {
      id,
      name,
      description,
      actions: [...actions],
      rollbackOnFailure: true,
      continueOnError: false
    };
  }

  // Get batch execution history
  getBatchHistory(): BatchResult[] {
    return [...this.batchHistory];
  }

  // Clear batch history
  clearBatchHistory(): void {
    this.batchHistory = [];
  }

  // Get active transactions
  getActiveTransactions(): ActionTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  // Validate action dependencies (simple dependency checking)
  validateActionDependencies(actions: MCPAction[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for conflicting actions (e.g., rename and delete on same target)
    const targetMap = new Map<string, MCPAction[]>();
    
    for (const action of actions) {
      const targetKey = this.getTargetKey(action);
      if (!targetMap.has(targetKey)) {
        targetMap.set(targetKey, []);
      }
      targetMap.get(targetKey)!.push(action);
    }

    // Check for conflicts
    for (const [targetKey, targetActions] of targetMap) {
      if (targetActions.length > 1) {
        const actionTypes = targetActions.map(a => a.type);
        
        // Check for conflicting combinations
        if (actionTypes.includes('rename') && actionTypes.includes('delete')) {
          errors.push(`Conflicting actions on ${targetKey}: rename and delete`);
        }
        
        if (actionTypes.includes('refactor') && actionTypes.includes('format')) {
          errors.push(`Potentially conflicting actions on ${targetKey}: refactor and format`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Private helper methods
  private getTargetKey(action: MCPAction): string {
    const target = action.target;
    return `${target.type}:${target.path || target.identifier || 'selection'}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup resources
  async destroy(): Promise<void> {
    // Rollback any uncommitted transactions
    for (const [transactionId, transaction] of this.activeTransactions) {
      if (!transaction.committed && !transaction.rolledBack) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (error) {
          console.error(`Failed to rollback transaction ${transactionId} during cleanup:`, error);
        }
      }
    }

    this.activeTransactions.clear();
    this.batchHistory = [];
  }
}