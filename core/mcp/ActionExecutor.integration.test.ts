/**
 * Integration tests for MCP Action Execution System
 * Tests the complete action execution workflow including rollback capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ActionExecutor } from './ActionExecutor.js';
import { ActionRegistry } from './ActionRegistry.js';
import { RollbackManager } from './RollbackManager.js';
import { DefaultMCPProvider } from './BaseMCPProvider.js';
import type {
  MCPAction,
  MCPContext,
  MCPProvider,
  ActionResult,
  CodeChange,
  MCPClientConfig
} from './types.js';

describe('MCP Action Execution System Integration', () => {
  let actionExecutor: ActionExecutor;
  let mockProvider: MCPProvider;
  let mockContext: MCPContext;
  let config: MCPClientConfig;

  beforeEach(async () => {
    config = {
      enableRealTimeUpdates: false,
      contextUpdateInterval: 100,
      maxHistorySize: 10,
      enableActionHistory: true
    };

    actionExecutor = new ActionExecutor(config);
    await actionExecutor.initialize();

    mockProvider = new DefaultMCPProvider();
    
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'function test() {\n  console.log("Hello, World!");\n  return true;\n}',
        language: 'javascript',
        cursor: { line: 1, column: 2 },
        modified: false,
        selection: {
          from: { line: 0, column: 0 },
          to: { line: 3, column: 1 },
          text: 'function test() {\n  console.log("Hello, World!");\n  return true;\n}'
        },
        path: 'test.js'
      },
      project: {
        structure: {
          'test.js': {
            type: 'file',
            content: 'function test() {\n  console.log("Hello, World!");\n  return true;\n}',
            size: 65,
            modified: new Date()
          }
        },
        config: {
          name: 'test-project',
          type: 'javascript',
          entry: 'test.js'
        },
        dependencies: []
      },
      execution: {
        history: [],
        environment: { NODE_ENV: 'test' }
      },
      user: {
        preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true },
        recentActions: [],
        activeFeatures: ['editor', 'runner']
      }
    };
  });

  afterEach(async () => {
    await actionExecutor.destroy();
  });

  describe('Action Execution Workflow', () => {
    it('should execute refactor action with built-in registry', async () => {
      const action: MCPAction = {
        id: 'refactor-action-1',
        type: 'refactor',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 3, column: 1 }
          }
        },
        parameters: {
          instruction: 'extract function'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.changes?.length).toBeGreaterThan(0);
      expect(result.changes?.[0].type).toBe('replace');
      expect(result.metadata?.instruction).toBe('extract function');

      // Verify action is in history
      const history = actionExecutor.getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('refactor-action-1');
    });

    it('should execute rename action with validation', async () => {
      const action: MCPAction = {
        id: 'rename-action-1',
        type: 'rename',
        target: {
          type: 'function',
          identifier: 'test'
        },
        parameters: {
          newName: 'testFunction'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.metadata?.newName).toBe('testFunction');
      expect(result.metadata?.oldName).toBe('test');
    });

    it('should execute document action and generate JSDoc', async () => {
      const action: MCPAction = {
        id: 'document-action-1',
        type: 'document',
        target: {
          type: 'function',
          identifier: 'test'
        },
        parameters: {
          style: 'jsdoc',
          includeExamples: true
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.changes?.[0].type).toBe('insert');
      expect(result.changes?.[0].content).toContain('/**');
      expect(result.changes?.[0].content).toContain('@example');
    });

    it('should execute generate action for new code', async () => {
      const action: MCPAction = {
        id: 'generate-action-1',
        type: 'generate',
        target: {
          type: 'selection',
          range: {
            from: { line: 3, column: 1 },
            to: { line: 3, column: 1 }
          }
        },
        parameters: {
          description: 'create a helper function that validates input',
          framework: 'vanilla'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.metadata?.description).toBe('create a helper function that validates input');
    });

    it('should execute explain action without changes', async () => {
      const action: MCPAction = {
        id: 'explain-action-1',
        type: 'explain',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 3, column: 1 }
          }
        },
        parameters: {
          level: 'beginner'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.metadata?.explanation).toBeDefined();
      expect(result.metadata?.level).toBe('beginner');
      expect(result.metadata?.language).toBe('javascript');
    });

    it('should execute format action', async () => {
      const action: MCPAction = {
        id: 'format-action-1',
        type: 'format',
        target: {
          type: 'file',
          path: 'test.js'
        },
        parameters: {
          style: 'standard',
          indentSize: 2
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.changes?.[0].type).toBe('replace');
      expect(result.metadata?.style).toBe('standard');
    });

    it('should execute optimize action', async () => {
      const action: MCPAction = {
        id: 'optimize-action-1',
        type: 'optimize',
        target: {
          type: 'function',
          identifier: 'test'
        },
        parameters: {
          target: 'performance',
          aggressive: false
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toBeDefined();
      expect(result.metadata?.optimizations).toBeDefined();
    });
  });

  describe('Action Validation and Error Handling', () => {
    it('should reject actions with missing required parameters', async () => {
      const action: MCPAction = {
        id: 'invalid-action-1',
        type: 'refactor',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 1, column: 0 }
          }
        },
        parameters: {}, // Missing required 'instruction' parameter
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(false);
      // The registry should catch this validation error first
      expect(result.error).toContain('Missing required parameter: instruction');
    });

    it('should reject actions with unsupported target types', async () => {
      const action: MCPAction = {
        id: 'invalid-action-2',
        type: 'refactor',
        target: {
          type: 'project' as any // refactor doesn't support project targets
        },
        parameters: {
          instruction: 'test instruction'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(false);
      // The registry should catch this validation error first
      expect(result.error).toContain('Target type');
    });

    it('should handle unknown action types', async () => {
      const action: MCPAction = {
        id: 'unknown-action-1',
        type: 'unknown-type' as any,
        target: {
          type: 'selection'
        },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(false);
      // Should fall back to provider, which will reject unknown types
      expect(result.error).toContain('Unsupported action type');
    });

    it('should handle provider execution failures', async () => {
      const failingProvider: MCPProvider = {
        id: 'failing-provider',
        name: 'Failing Provider',
        capabilities: ['action_execution'],
        processContext: vi.fn(async () => ({
          summary: 'test',
          relevantFiles: [],
          suggestions: [],
          metadata: {}
        })),
        executeAction: vi.fn(async () => {
          throw new Error('Provider execution failed');
        })
      };

      const action: MCPAction = {
        id: 'failing-action-1',
        type: 'custom-action' as any,
        target: {
          type: 'selection'
        },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['failing', failingProvider]]);
      const result = await actionExecutor.executeAction(action, mockContext, providers);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action execution failed');
    });
  });

  describe('Rollback System Integration', () => {
    it('should create rollback snapshots and rollback successfully', async () => {
      const action: MCPAction = {
        id: 'rollback-test-1',
        type: 'refactor',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 3, column: 1 }
          }
        },
        parameters: {
          instruction: 'extract function'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      
      // Execute action
      const result = await actionExecutor.executeAction(action, mockContext, providers);
      expect(result.success).toBe(true);

      // Verify rollback info is available
      const rollbackInfo = actionExecutor.getRollbackInfo('rollback-test-1');
      expect(rollbackInfo).toBeDefined();
      expect(rollbackInfo?.success).toBe(true);

      // Perform rollback
      const rollbackSuccess = await actionExecutor.rollbackAction('rollback-test-1');
      expect(rollbackSuccess).toBe(true);

      // Verify action is removed from history
      const history = actionExecutor.getActionHistory();
      expect(history.find(a => a.id === 'rollback-test-1')).toBeUndefined();
    });

    it('should rollback last action', async () => {
      const action1: MCPAction = {
        id: 'rollback-last-1',
        type: 'format',
        target: { type: 'file', path: 'test.js' },
        parameters: {},
        timestamp: new Date()
      };

      const action2: MCPAction = {
        id: 'rollback-last-2',
        type: 'optimize',
        target: { type: 'function', identifier: 'test' },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);

      // Execute both actions
      await actionExecutor.executeAction(action1, mockContext, providers);
      await actionExecutor.executeAction(action2, mockContext, providers);

      // Rollback last action
      const rollbackSuccess = await actionExecutor.rollbackLastAction();
      expect(rollbackSuccess).toBe(true);

      // Verify only the last action was rolled back
      const history = actionExecutor.getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('rollback-last-1');
    });

    it('should rollback multiple actions', async () => {
      const actions: MCPAction[] = [
        {
          id: 'multi-rollback-1',
          type: 'format',
          target: { type: 'file', path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'multi-rollback-2',
          type: 'optimize',
          target: { type: 'function', identifier: 'test' },
          parameters: {},
          timestamp: new Date()
        },
        {
          id: 'multi-rollback-3',
          type: 'document',
          target: { type: 'function', identifier: 'test' },
          parameters: {},
          timestamp: new Date()
        }
      ];

      const providers = new Map([['default', mockProvider]]);

      // Execute all actions
      for (const action of actions) {
        await actionExecutor.executeAction(action, mockContext, providers);
      }

      // Rollback last 2 actions
      const rollbackResults = await actionExecutor.rollbackMultipleActions(2);
      expect(rollbackResults).toHaveLength(2);
      expect(rollbackResults[0]).toBe(true);
      expect(rollbackResults[1]).toBe(true);

      // Verify only first action remains
      const history = actionExecutor.getActionHistory();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('multi-rollback-1');
    });

    it('should handle rollback failures gracefully', async () => {
      // Try to rollback non-existent action
      const rollbackSuccess = await actionExecutor.rollbackAction('non-existent-action');
      expect(rollbackSuccess).toBe(false);

      // Try to rollback when no actions exist
      const rollbackLastSuccess = await actionExecutor.rollbackLastAction();
      expect(rollbackLastSuccess).toBe(false);
    });
  });

  describe('Action History Management', () => {
    it('should maintain action history with proper ordering', async () => {
      const actions: MCPAction[] = [
        {
          id: 'history-1',
          type: 'format',
          target: { type: 'file', path: 'test.js' },
          parameters: {},
          timestamp: new Date(Date.now() - 3000)
        },
        {
          id: 'history-2',
          type: 'optimize',
          target: { type: 'function', identifier: 'test' },
          parameters: {},
          timestamp: new Date(Date.now() - 2000)
        },
        {
          id: 'history-3',
          type: 'document',
          target: { type: 'function', identifier: 'test' },
          parameters: {},
          timestamp: new Date(Date.now() - 1000)
        }
      ];

      const providers = new Map([['default', mockProvider]]);

      // Execute actions
      for (const action of actions) {
        await actionExecutor.executeAction(action, mockContext, providers);
      }

      const history = actionExecutor.getActionHistory();
      expect(history).toHaveLength(3);
      expect(history.map(a => a.id)).toEqual(['history-1', 'history-2', 'history-3']);
    });

    it('should enforce history size limits', async () => {
      // Create executor with small history limit
      const smallConfig: MCPClientConfig = {
        ...config,
        maxHistorySize: 2
      };
      const limitedExecutor = new ActionExecutor(smallConfig);
      await limitedExecutor.initialize();

      const providers = new Map([['default', mockProvider]]);

      // Execute more actions than the limit
      for (let i = 0; i < 5; i++) {
        const action: MCPAction = {
          id: `limit-test-${i}`,
          type: 'format',
          target: { type: 'file', path: 'test.js' },
          parameters: {},
          timestamp: new Date()
        };
        await limitedExecutor.executeAction(action, mockContext, providers);
      }

      const history = limitedExecutor.getActionHistory();
      expect(history).toHaveLength(2);
      
      // Should keep the most recent actions
      expect(history.map(a => a.id)).toEqual(['limit-test-3', 'limit-test-4']);

      await limitedExecutor.destroy();
    });

    it('should clear action history', async () => {
      const action: MCPAction = {
        id: 'clear-test-1',
        type: 'format',
        target: { type: 'file', path: 'test.js' },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      await actionExecutor.executeAction(action, mockContext, providers);

      expect(actionExecutor.getActionHistory()).toHaveLength(1);

      actionExecutor.clearActionHistory();
      expect(actionExecutor.getActionHistory()).toHaveLength(0);
    });

    it('should provide detailed action history', async () => {
      const action: MCPAction = {
        id: 'detailed-test-1',
        type: 'refactor',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 1, column: 0 }
          }
        },
        parameters: {
          instruction: 'extract function'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      await actionExecutor.executeAction(action, mockContext, providers);

      const detailedHistory = actionExecutor.getDetailedActionHistory();
      expect(detailedHistory).toHaveLength(1);
      
      const entry = detailedHistory[0];
      expect(entry.action.id).toBe('detailed-test-1');
      expect(entry.result.success).toBe(true);
      expect(entry.context).toBeDefined();
      expect(entry.timestamp).toBeDefined();
    });
  });

  describe('Custom Action Registration', () => {
    it('should register and execute custom actions', async () => {
      const customActionDefinition = {
        type: 'custom-test' as any,
        name: 'Custom Test Action',
        description: 'A custom action for testing',
        supportedTargets: ['selection' as const],
        requiredParameters: ['customParam'],
        optionalParameters: ['optionalParam'],
        handler: vi.fn(async (action: MCPAction, context: MCPContext) => ({
          success: true,
          changes: [{
            type: 'replace' as const,
            path: context.buffer.path || 'test.js',
            content: `// Custom action executed: ${action.parameters.customParam}`
          }],
          metadata: {
            customParam: action.parameters.customParam,
            executedAt: new Date()
          }
        }))
      };

      actionExecutor.registerCustomAction(customActionDefinition);

      const customAction: MCPAction = {
        id: 'custom-action-1',
        type: 'custom-test' as any,
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 1, column: 0 }
          }
        },
        parameters: {
          customParam: 'test value'
        },
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      const result = await actionExecutor.executeAction(customAction, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.metadata?.customParam).toBe('test value');
      expect(customActionDefinition.handler).toHaveBeenCalledWith(customAction, mockContext);
    });

    it('should list available actions including custom ones', async () => {
      const customActionDefinition = {
        type: 'list-test' as any,
        name: 'List Test Action',
        description: 'A custom action for list testing',
        supportedTargets: ['file' as const],
        requiredParameters: [],
        optionalParameters: [],
        handler: vi.fn(async () => ({ success: true }))
      };

      actionExecutor.registerCustomAction(customActionDefinition);

      const availableActions = actionExecutor.getAvailableActions();
      expect(availableActions.length).toBeGreaterThan(7); // Built-in actions + custom
      
      const customAction = availableActions.find(a => a.type === 'list-test');
      expect(customAction).toBeDefined();
      expect(customAction?.name).toBe('List Test Action');
    });
  });

  describe('Rollback Statistics and Information', () => {
    it('should provide rollback statistics', async () => {
      const action: MCPAction = {
        id: 'stats-test-1',
        type: 'format',
        target: { type: 'file', path: 'test.js' },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      await actionExecutor.executeAction(action, mockContext, providers);

      const stats = actionExecutor.getRollbackStatistics();
      expect(stats.totalSnapshots).toBe(1);
      expect(stats.averageSnapshotSize).toBeGreaterThan(0);
    });

    it('should provide rollback information for specific actions', async () => {
      const action: MCPAction = {
        id: 'info-test-1',
        type: 'optimize',
        target: { type: 'function', identifier: 'test' },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['default', mockProvider]]);
      await actionExecutor.executeAction(action, mockContext, providers);

      const rollbackInfo = actionExecutor.getRollbackInfo('info-test-1');
      expect(rollbackInfo).toBeDefined();
      expect(rollbackInfo?.success).toBe(true);
      expect(rollbackInfo?.metadata?.actionId).toBe('info-test-1');
      expect(rollbackInfo?.metadata?.canRollback).toBe(true);
    });
  });

  describe('Provider Fallback System', () => {
    it('should fallback to providers when registry execution fails', async () => {
      const customProvider: MCPProvider = {
        id: 'custom-provider',
        name: 'Custom Provider',
        capabilities: ['action_execution'],
        processContext: vi.fn(async () => ({
          summary: 'test',
          relevantFiles: [],
          suggestions: [],
          metadata: {}
        })),
        executeAction: vi.fn(async (action: MCPAction) => ({
          success: true,
          changes: [{
            type: 'insert' as const,
            path: 'test.js',
            content: `// Provider executed: ${action.type}`
          }],
          metadata: { providerId: 'custom-provider' }
        }))
      };

      const unknownAction: MCPAction = {
        id: 'fallback-test-1',
        type: 'unknown-action' as any,
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      const providers = new Map([['custom', customProvider]]);
      const result = await actionExecutor.executeAction(unknownAction, mockContext, providers);

      expect(result.success).toBe(true);
      expect(result.metadata?.providerId).toBe('custom-provider');
      expect(customProvider.executeAction).toHaveBeenCalledWith(unknownAction, mockContext);
    });
  });
});