/**
 * Unit tests for ActionRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActionRegistry } from './ActionRegistry.js';
import type { MCPAction, MCPContext, ActionDefinition } from './types.js';

describe('ActionRegistry', () => {
  let registry: ActionRegistry;
  let mockContext: MCPContext;
  let mockAction: MCPAction;

  beforeEach(() => {
    registry = new ActionRegistry();
    
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'function test() {\n  console.log("test");\n}',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false,
        selection: {
          from: { line: 0, column: 0 },
          to: { line: 2, column: 1 },
          text: 'function test() {\n  console.log("test");\n}'
        }
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

    mockAction = {
      id: 'test-action-1',
      type: 'explain',
      target: {
        type: 'selection',
        range: {
          from: { line: 0, column: 0 },
          to: { line: 2, column: 1 }
        }
      },
      parameters: {},
      timestamp: new Date()
    };
  });

  describe('built-in actions', () => {
    it('should have built-in actions registered', () => {
      const actions = registry.listActions();
      
      expect(actions.length).toBeGreaterThan(0);
      
      const actionTypes = actions.map(a => a.type);
      expect(actionTypes).toContain('refactor');
      expect(actionTypes).toContain('rename');
      expect(actionTypes).toContain('document');
      expect(actionTypes).toContain('generate');
      expect(actionTypes).toContain('explain');
      expect(actionTypes).toContain('format');
      expect(actionTypes).toContain('optimize');
    });

    it('should get specific action definition', () => {
      const explainAction = registry.getAction('explain');
      
      expect(explainAction).toBeDefined();
      expect(explainAction?.name).toBe('Explain Code');
      expect(explainAction?.supportedTargets).toContain('selection');
    });
  });

  describe('custom action registration', () => {
    it('should register custom actions', () => {
      const customAction: ActionDefinition = {
        type: 'custom-test' as any,
        name: 'Custom Test Action',
        description: 'A test action',
        supportedTargets: ['selection'],
        requiredParameters: ['testParam'],
        optionalParameters: [],
        handler: async () => ({ success: true })
      };

      registry.registerAction(customAction);
      
      const retrieved = registry.getAction('custom-test' as any);
      expect(retrieved).toBe(customAction);
    });

    it('should unregister actions', () => {
      const customAction: ActionDefinition = {
        type: 'custom-test' as any,
        name: 'Custom Test Action',
        description: 'A test action',
        supportedTargets: ['selection'],
        requiredParameters: [],
        optionalParameters: [],
        handler: async () => ({ success: true })
      };

      registry.registerAction(customAction);
      expect(registry.getAction('custom-test' as any)).toBeDefined();
      
      registry.unregisterAction('custom-test' as any);
      expect(registry.getAction('custom-test' as any)).toBeNull();
    });
  });

  describe('action validation', () => {
    it('should validate valid actions', () => {
      const validation = registry.validateAction(mockAction);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject unknown action types', () => {
      const invalidAction = {
        ...mockAction,
        type: 'unknown-action' as any
      };

      const validation = registry.validateAction(invalidAction);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unknown action type: unknown-action');
    });

    it('should reject unsupported target types', () => {
      const invalidAction = {
        ...mockAction,
        type: 'refactor',
        target: {
          type: 'project' as any, // refactor doesn't support project targets
          range: mockAction.target.range
        }
      };

      const validation = registry.validateAction(invalidAction);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Target type'))).toBe(true);
    });

    it('should require missing parameters', () => {
      const invalidAction = {
        ...mockAction,
        type: 'refactor',
        parameters: {} // missing required 'instruction' parameter
      };

      const validation = registry.validateAction(invalidAction);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing required parameter: instruction');
    });

    it('should validate target-specific requirements', () => {
      const invalidAction = {
        ...mockAction,
        target: {
          type: 'selection',
          // missing range property
        }
      };

      const validation = registry.validateAction(invalidAction);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Selection target requires range property');
    });
  });

  describe('action execution', () => {
    it('should execute explain actions', async () => {
      const result = await registry.executeAction(mockAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.explanation).toBeDefined();
      expect(result.metadata?.language).toBe('javascript');
    });

    it('should execute refactor actions', async () => {
      const refactorAction = {
        ...mockAction,
        type: 'refactor' as const,
        parameters: {
          instruction: 'extract function'
        }
      };

      const result = await registry.executeAction(refactorAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0].type).toBe('replace');
    });

    it('should execute rename actions', async () => {
      const renameAction = {
        ...mockAction,
        type: 'rename' as const,
        target: {
          ...mockAction.target,
          identifier: 'test'
        },
        parameters: {
          newName: 'newTest'
        }
      };

      const result = await registry.executeAction(renameAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.metadata?.newName).toBe('newTest');
    });

    it('should execute document actions', async () => {
      const documentAction = {
        ...mockAction,
        type: 'document' as const
      };

      const result = await registry.executeAction(documentAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0].type).toBe('insert');
      expect(result.changes?.[0].content).toContain('/**');
    });

    it('should execute generate actions', async () => {
      const generateAction = {
        ...mockAction,
        type: 'generate' as const,
        parameters: {
          description: 'create a function'
        }
      };

      const result = await registry.executeAction(generateAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.metadata?.description).toBe('create a function');
    });

    it('should execute format actions', async () => {
      const formatAction = {
        ...mockAction,
        type: 'format' as const
      };

      const result = await registry.executeAction(formatAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0].type).toBe('replace');
    });

    it('should execute optimize actions', async () => {
      const optimizeAction = {
        ...mockAction,
        type: 'optimize' as const
      };

      const result = await registry.executeAction(optimizeAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.metadata?.optimizations).toBeDefined();
    });

    it('should handle validation failures during execution', async () => {
      const invalidAction = {
        ...mockAction,
        type: 'unknown-action' as any
      };

      const result = await registry.executeAction(invalidAction, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Action validation failed');
    });

    it('should handle execution errors', async () => {
      const customAction: ActionDefinition = {
        type: 'error-action' as any,
        name: 'Error Action',
        description: 'An action that throws errors',
        supportedTargets: ['selection'],
        requiredParameters: [],
        optionalParameters: [],
        handler: async () => {
          throw new Error('Test error');
        }
      };

      registry.registerAction(customAction);

      const errorAction = {
        ...mockAction,
        type: 'error-action' as any
      };

      const result = await registry.executeAction(errorAction, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Action execution failed');
    });
  });

  describe('code manipulation helpers', () => {
    it('should extract code from different target types', async () => {
      // This tests the private extractCodeFromTarget method indirectly
      const selectionAction = {
        ...mockAction,
        type: 'explain' as const
      };

      const fileAction = {
        ...mockAction,
        type: 'explain' as const,
        target: {
          type: 'file' as const,
          path: 'test.js'
        }
      };

      // Both should execute successfully, indicating code extraction works
      await expect(registry.executeAction(selectionAction, mockContext)).resolves.toMatchObject({
        success: true
      });

      await expect(registry.executeAction(fileAction, mockContext)).resolves.toMatchObject({
        success: true
      });
    });
  });
});