/**
 * Unit tests for MCPClient
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPClientImpl } from './MCPClient.js';
import { DefaultMCPProvider } from './BaseMCPProvider.js';
import type { MCPContext, MCPAction, MCPProvider } from './types.js';

// Mock ContextCollector
vi.mock('./ContextCollector.js', () => ({
  ContextCollector: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    destroy: vi.fn(),
    collectContext: vi.fn(async () => ({
      id: 'test-context-id',
      timestamp: new Date(),
      buffer: {
        content: 'console.log("test");',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false
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
    })),
    collectProjectContext: vi.fn(async () => ({
      structure: {},
      config: {},
      dependencies: []
    })),
    collectExecutionContext: vi.fn(async () => ({
      history: [],
      environment: {}
    }))
  }))
}));

// Mock ActionExecutor
vi.mock('./ActionExecutor.js', () => ({
  ActionExecutor: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    destroy: vi.fn(),
    executeAction: vi.fn(async () => ({
      success: true,
      changes: [],
      metadata: { test: true }
    })),
    rollbackAction: vi.fn(async () => true),
    rollbackLastAction: vi.fn(async () => true),
    rollbackMultipleActions: vi.fn(async () => [true]),
    getRollbackInfo: vi.fn(() => null),
    getActionHistory: vi.fn(() => []),
    clearActionHistory: vi.fn(),
    getDetailedActionHistory: vi.fn(() => []),
    getRollbackStatistics: vi.fn(() => ({ totalSnapshots: 0, averageSnapshotSize: 0 })),
    registerCustomAction: vi.fn(),
    getAvailableActions: vi.fn(() => [])
  }))
}));

describe('MCPClient', () => {
  let mcpClient: MCPClientImpl;
  let mockProvider: MCPProvider;

  beforeEach(async () => {
    mcpClient = new MCPClientImpl({
      enableRealTimeUpdates: false, // Disable for testing
      contextUpdateInterval: 100,
      maxHistorySize: 10,
      enableActionHistory: true
    });

    mockProvider = new DefaultMCPProvider();
    await mcpClient.initialize();
  });

  afterEach(async () => {
    await mcpClient.destroy();
    vi.clearAllMocks();
  });

  describe('initialization and lifecycle', () => {
    it('should initialize successfully', async () => {
      const freshClient = new MCPClientImpl();
      await expect(freshClient.initialize()).resolves.not.toThrow();
      await freshClient.destroy();
    });

    it('should destroy successfully', async () => {
      await expect(mcpClient.destroy()).resolves.not.toThrow();
    });
  });

  describe('context collection', () => {
    it('should collect current context', async () => {
      const context = await mcpClient.getCurrentContext();

      expect(context).toBeDefined();
      expect(context.id).toBe('test-context-id');
      expect(context.buffer.content).toBe('console.log("test");');
      expect(context.buffer.language).toBe('javascript');
    });

    it('should collect project context', async () => {
      const projectContext = await mcpClient.getProjectContext();

      expect(projectContext).toBeDefined();
      expect(projectContext.structure).toEqual({});
      expect(projectContext.config).toEqual({});
      expect(projectContext.dependencies).toEqual([]);
    });

    it('should collect execution context', async () => {
      const executionContext = await mcpClient.getExecutionContext();

      expect(executionContext).toBeDefined();
      expect(executionContext.history).toEqual([]);
      expect(executionContext.environment).toEqual({});
    });

    it('should handle context collection errors', async () => {
      // Mock a context collection error
      const errorClient = new MCPClientImpl();
      const mockContextCollector = {
        initialize: vi.fn(),
        destroy: vi.fn(),
        collectContext: vi.fn(async () => { throw new Error('Context collection failed'); })
      };
      (errorClient as any).contextCollector = mockContextCollector;

      await expect(errorClient.getCurrentContext()).rejects.toThrow('Failed to collect current context');
    });
  });

  describe('provider management', () => {
    it('should register providers', async () => {
      await mcpClient.registerProvider(mockProvider);

      const providers = mcpClient.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('default');
    });

    it('should unregister providers', async () => {
      await mcpClient.registerProvider(mockProvider);
      await mcpClient.unregisterProvider('default');

      const providers = mcpClient.listProviders();
      expect(providers).toHaveLength(0);
    });

    it('should get specific provider', async () => {
      await mcpClient.registerProvider(mockProvider);

      const provider = mcpClient.getProvider('default');
      expect(provider).toBe(mockProvider);

      const nonExistentProvider = mcpClient.getProvider('non-existent');
      expect(nonExistentProvider).toBeNull();
    });

    it('should list all providers', async () => {
      const provider1 = new DefaultMCPProvider();
      const provider2 = { ...mockProvider, id: 'test-provider-2' };

      await mcpClient.registerProvider(provider1);
      await mcpClient.registerProvider(provider2 as MCPProvider);

      const providers = mcpClient.listProviders();
      expect(providers).toHaveLength(2);
    });
  });

  describe('action execution', () => {
    beforeEach(async () => {
      await mcpClient.registerProvider(mockProvider);
    });

    it('should execute actions successfully', async () => {
      const action: MCPAction = {
        id: 'test-action-1',
        type: 'explain',
        target: {
          type: 'selection',
          range: {
            from: { line: 0, column: 0 },
            to: { line: 0, column: 7 }
          }
        },
        parameters: {},
        timestamp: new Date()
      };

      const result = await mcpClient.executeAction(action);

      expect(result.success).toBe(true);
      expect(result.changes).toEqual([]);
      expect(result.metadata).toBeDefined();
    });

    it('should handle action execution errors', async () => {
      // Mock both provider manager and action executor to fail
      const errorProviderManager = {
        executeWithFallback: vi.fn(async () => ({ success: false, error: 'Provider failed' })),
        listProviders: vi.fn(() => []),
        destroy: vi.fn()
      };
      const errorExecutor = {
        executeAction: vi.fn(async () => { throw new Error('Action execution failed'); }),
        destroy: vi.fn()
      };
      
      (mcpClient as any).providerManager = errorProviderManager;
      (mcpClient as any).actionExecutor = errorExecutor;

      const action: MCPAction = {
        id: 'test-action-error',
        type: 'explain',
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      await expect(mcpClient.executeAction(action)).rejects.toThrow('Failed to execute action');
    });

    it('should rollback actions', async () => {
      const success = await mcpClient.rollbackAction('test-action-1');
      expect(success).toBe(true);
    });

    it('should handle rollback errors', async () => {
      // Mock a rollback error
      const errorExecutor = {
        initialize: vi.fn(),
        destroy: vi.fn(),
        executeAction: vi.fn(),
        rollbackAction: vi.fn(async () => { throw new Error('Rollback failed'); }),
        getActionHistory: vi.fn(() => []),
        clearActionHistory: vi.fn()
      };
      (mcpClient as any).actionExecutor = errorExecutor;

      await expect(mcpClient.rollbackAction('test-action-1')).rejects.toThrow('Failed to rollback action');
    });
  });

  describe('action history', () => {
    it('should get action history', () => {
      const history = mcpClient.getActionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should clear action history', () => {
      expect(() => mcpClient.clearActionHistory()).not.toThrow();
    });
  });

  describe('context change notifications', () => {
    it('should register context change callbacks', () => {
      const callback = vi.fn();
      
      mcpClient.onContextChange(callback);
      
      // Verify callback was registered (we can't directly test this without exposing internals)
      expect(() => mcpClient.onContextChange(callback)).not.toThrow();
    });

    it('should unregister context change callbacks', () => {
      const callback = vi.fn();
      
      mcpClient.onContextChange(callback);
      mcpClient.offContextChange(callback);
      
      // Verify callback was unregistered
      expect(() => mcpClient.offContextChange(callback)).not.toThrow();
    });
  });

  describe('events', () => {
    it('should emit provider registration events', async () => {
      const eventPromise = new Promise((resolve) => {
        mcpClient.on('providerRegistered', (event) => {
          expect(event.providerId).toBe('test-provider');
          resolve(event);
        });
      });

      const testProvider = { ...mockProvider, id: 'test-provider' };
      await mcpClient.registerProvider(testProvider as MCPProvider);
      
      await eventPromise;
    });

    it('should emit provider unregistration events', async () => {
      const testProvider = { ...mockProvider, id: 'test-provider' };
      await mcpClient.registerProvider(testProvider as MCPProvider);

      const eventPromise = new Promise((resolve) => {
        mcpClient.on('providerUnregistered', (event) => {
          expect(event.providerId).toBe('test-provider');
          resolve(event);
        });
      });

      await mcpClient.unregisterProvider('test-provider');
      
      await eventPromise;
    });

    it('should emit action history cleared events', async () => {
      const eventPromise = new Promise((resolve) => {
        mcpClient.on('actionHistoryCleared', () => {
          resolve(true);
        });
      });

      mcpClient.clearActionHistory();
      
      await eventPromise;
    });
  });

  describe('error handling', () => {
    it('should create proper MCP errors', async () => {
      // Force an error by providing invalid context collector
      const errorClient = new MCPClientImpl();
      (errorClient as any).contextCollector = {
        initialize: vi.fn(),
        destroy: vi.fn(),
        collectContext: vi.fn(async () => { throw new Error('Test error'); })
      };

      try {
        await errorClient.getCurrentContext();
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe('CONTEXT_COLLECTION_FAILED');
        expect(error.message).toContain('Failed to collect current context');
        expect(error.retryable).toBe(true);
      }
    });
  });
});