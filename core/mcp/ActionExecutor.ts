/**
 * Action Executor - Handles MCP action execution and rollback
 * Manages action history and provides rollback capabilities
 */

import type {
  MCPAction,
  MCPActionId,
  ActionResult,
  MCPContext,
  MCPProvider,
  MCPProviderId,
  CodeChange,
  ActionTarget,
  MCPClientConfig
} from './types.js';

import { ActionRegistry } from './ActionRegistry.js';
import { RollbackManager, type RollbackResult } from './RollbackManager.js';

interface ActionHistoryEntry {
  action: MCPAction;
  result: ActionResult;
  context: MCPContext;
  timestamp: Date;
  rollbackData?: RollbackData;
}

interface RollbackData {
  originalContent?: string;
  originalSelection?: any;
  changes: CodeChange[];
}

export class ActionExecutor {
  private actionHistory: ActionHistoryEntry[] = [];
  private config: MCPClientConfig;
  private actionRegistry: ActionRegistry;
  private rollbackManager: RollbackManager;

  constructor(config: MCPClientConfig) {
    this.config = config;
    this.actionRegistry = new ActionRegistry();
    this.rollbackManager = new RollbackManager(config.maxHistorySize);
  }

  async initialize(): Promise<void> {
    // Initialize any required resources
  }

  async destroy(): Promise<void> {
    this.actionHistory = [];
    this.rollbackManager.clearHistory();
  }

  async executeAction(
    action: MCPAction,
    context: MCPContext,
    providers: Map<MCPProviderId, MCPProvider>
  ): Promise<ActionResult> {
    try {
      // Create rollback snapshot before executing (for both registry and provider execution)
      if (this.config.enableActionHistory) {
        this.rollbackManager.createSnapshot(
          action.id,
          context,
          [] // Will be populated after execution
        );
      }

      // First try to execute using the built-in action registry
      const registryResult = await this.executeWithRegistry(action, context);
      if (registryResult.success) {
        // Update rollback snapshot with actual changes
        if (this.config.enableActionHistory && registryResult.changes) {
          this.rollbackManager.updateSnapshot(action.id, registryResult.changes);
        }
        return registryResult;
      }

      // If registry failed due to validation errors (but not unknown action type), return that error immediately
      if (registryResult.error && (
        registryResult.error.includes('Missing required parameter') ||
        registryResult.error.includes('Target type') ||
        registryResult.error.includes('requires') ||
        registryResult.error.includes('not supported')
      ) && !registryResult.error.includes('Unknown action type')) {
        // Remove rollback snapshot since execution failed
        if (this.config.enableActionHistory) {
          this.rollbackManager.removeSnapshot(action.id);
        }
        return registryResult;
      }

      // Fall back to provider-based execution for unknown action types
      const provider = this.findSuitableProvider(action, providers);
      if (!provider) {
        // Remove rollback snapshot since execution failed
        if (this.config.enableActionHistory) {
          this.rollbackManager.removeSnapshot(action.id);
        }
        return {
          success: false,
          error: `No suitable provider found for action type: ${action.type}`
        };
      }

      // Execute the action with provider
      const result = await provider.executeAction(action, context);

      if (result.success) {
        // Update rollback snapshot with actual changes
        if (this.config.enableActionHistory && result.changes) {
          this.rollbackManager.updateSnapshot(action.id, result.changes);
        }

        // Store in history if enabled
        if (this.config.enableActionHistory) {
          this.addToHistory({
            action,
            result,
            context,
            timestamp: new Date()
          });
        }
      } else {
        // Remove rollback snapshot since execution failed
        if (this.config.enableActionHistory) {
          this.rollbackManager.removeSnapshot(action.id);
        }
      }

      return result;
    } catch (error) {
      // Remove rollback snapshot on error
      if (this.config.enableActionHistory) {
        this.rollbackManager.removeSnapshot(action.id);
      }

      return {
        success: false,
        error: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Execute action using the built-in action registry
  private async executeWithRegistry(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    try {
      const result = await this.actionRegistry.executeAction(action, context);

      // Store in history if enabled and successful
      if (this.config.enableActionHistory && result.success) {
        this.addToHistory({
          action,
          result,
          context,
          timestamp: new Date()
        });
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Registry execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async rollbackAction(actionId: MCPActionId): Promise<boolean> {
    try {
      const rollbackResult = await this.rollbackManager.rollback(actionId);
      
      if (rollbackResult.success) {
        // Remove from action history
        this.actionHistory = this.actionHistory.filter(entry => entry.action.id !== actionId);
        return true;
      } else {
        console.error('Rollback failed:', rollbackResult.error);
        return false;
      }
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  // Rollback the last action
  async rollbackLastAction(): Promise<boolean> {
    try {
      const rollbackResult = await this.rollbackManager.rollbackLast();
      
      if (rollbackResult.success && rollbackResult.metadata?.actionId) {
        // Remove from action history
        const actionId = rollbackResult.metadata.actionId as MCPActionId;
        this.actionHistory = this.actionHistory.filter(entry => entry.action.id !== actionId);
        return true;
      } else {
        console.error('Rollback last action failed:', rollbackResult.error);
        return false;
      }
    } catch (error) {
      console.error('Rollback last action failed:', error);
      return false;
    }
  }

  // Rollback multiple actions
  async rollbackMultipleActions(count: number): Promise<boolean[]> {
    try {
      const rollbackResults = await this.rollbackManager.rollbackMultiple(count);
      
      // Remove successful rollbacks from history
      for (const result of rollbackResults) {
        if (result.success && result.metadata?.actionId) {
          const actionId = result.metadata.actionId as MCPActionId;
          this.actionHistory = this.actionHistory.filter(entry => entry.action.id !== actionId);
        }
      }
      
      return rollbackResults.map(result => result.success);
    } catch (error) {
      console.error('Rollback multiple actions failed:', error);
      return [];
    }
  }

  // Get rollback information
  getRollbackInfo(actionId: MCPActionId): RollbackResult | null {
    const snapshot = this.rollbackManager.getSnapshot(actionId);
    if (!snapshot) {
      return null;
    }

    return {
      success: true,
      metadata: {
        actionId: snapshot.actionId,
        timestamp: snapshot.timestamp,
        changesCount: snapshot.changes.length,
        canRollback: this.rollbackManager.canRollback(actionId)
      }
    };
  }

  getActionHistory(): MCPAction[] {
    return this.actionHistory.map(entry => entry.action);
  }

  clearActionHistory(): void {
    this.actionHistory = [];
    this.rollbackManager.clearHistory();
  }

  // Get detailed action history with results
  getDetailedActionHistory(): ActionHistoryEntry[] {
    return [...this.actionHistory];
  }

  // Get rollback statistics
  getRollbackStatistics() {
    return this.rollbackManager.getStatistics();
  }

  // Register a custom action
  registerCustomAction(definition: unknown): void {
    this.actionRegistry.registerAction(definition);
  }

  // Get available actions
  getAvailableActions() {
    return this.actionRegistry.listActions();
  }

  // Private methods
  private findSuitableProvider(
    action: MCPAction,
    providers: Map<MCPProviderId, MCPProvider>
  ): MCPProvider | null {
    // Find providers that support action execution
    const suitableProviders = Array.from(providers.values()).filter(provider =>
      provider.capabilities.includes('action_execution')
    );

    // For now, return the first suitable provider
    // In a real implementation, you might want more sophisticated selection logic
    return suitableProviders[0] || null;
  }

  private async prepareRollbackData(action: MCPAction, context: MCPContext): Promise<RollbackData> {
    const rollbackData: RollbackData = {
      changes: []
    };

    // Store original content based on action target
    switch (action.target.type) {
      case 'selection':
        rollbackData.originalContent = context.buffer.selection?.text || '';
        rollbackData.originalSelection = context.buffer.selection;
        break;
      
      case 'file':
        rollbackData.originalContent = context.buffer.content;
        break;
      
      case 'function':
      case 'class':
        // For function/class targets, we'd need to extract the specific content
        // This would require more sophisticated parsing
        rollbackData.originalContent = this.extractTargetContent(action.target, context);
        break;
    }

    return rollbackData;
  }

  private extractTargetContent(target: ActionTarget, context: MCPContext): string {
    // This is a simplified implementation
    // In a real implementation, you'd use AST parsing to extract specific functions/classes
    if (target.range) {
      return context.buffer.selection?.text || '';
    }
    return context.buffer.content;
  }

  private async performRollback(rollbackData: RollbackData, action: MCPAction): Promise<void> {
    // This is where you'd actually apply the rollback changes
    // In a real implementation, this would interact with the editor engine
    
    // For now, we'll just log what would be rolled back
    console.log('Rolling back action:', action.id);
    console.log('Rollback data:', rollbackData);

    // Apply reverse changes
    for (const change of rollbackData.changes.reverse()) {
      await this.applyReverseChange(change);
    }
  }

  private async applyReverseChange(change: CodeChange): Promise<void> {
    // Apply the reverse of a code change
    // This would interact with the editor engine to undo changes
    switch (change.type) {
      case 'insert':
        // Reverse of insert is delete
        console.log('Would delete inserted content at:', change.path);
        break;
      
      case 'replace':
        // Reverse of replace is replace back with original
        console.log('Would restore original content at:', change.path);
        break;
      
      case 'delete':
        // Reverse of delete is insert
        console.log('Would restore deleted content at:', change.path);
        break;
    }
  }

  private addToHistory(entry: ActionHistoryEntry): void {
    this.actionHistory.push(entry);

    // Keep history size manageable
    if (this.actionHistory.length > this.config.maxHistorySize) {
      const removed = this.actionHistory.shift();
      if (removed) {
        // Also remove from rollback manager
        this.rollbackManager.removeSnapshot(removed.action.id);
      }
    }
  }
}