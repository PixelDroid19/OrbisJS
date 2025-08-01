/**
 * Unit tests for ProviderManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderManager } from './ProviderManager.js';
import { DefaultMCPProvider } from './BaseMCPProvider.js';
import type { MCPProvider, MCPContext, MCPAction } from './types.js';

// Mock provider for testing
class MockMCPProvider extends DefaultMCPProvider {
  public initializeCalled = false;
  public destroyCalled = false;
  public shouldFail = false;

  constructor(id: string, capabilities: any[] = ['context_processing', 'action_execution']) {
    super();
    (this as any).id = id;
    (this as any).name = `Mock Provider ${id}`;
    (this as any).capabilities = capabilities;
  }

  async initialize(): Promise<void> {
    this.initializeCalled = true;
    if (this.shouldFail) {
      throw new Error('Initialization failed');
    }
  }

  async destroy(): Promise<void> {
    this.destroyCalled = true;
  }

  async processContext(context: MCPContext) {
    if (this.shouldFail) {
      throw new Error('Processing failed');
    }
    return super.processContext(context);
  }

  async executeAction(action: MCPAction, context: MCPContext) {
    if (this.shouldFail) {
      throw new Error('Execution failed');
    }
    return super.executeAction(action, context);
  }
}

describe('ProviderManager', () => {
  let providerManager: ProviderManager;
  let mockProvider1: MockMCPProvider;
  let mockProvider2: MockMCPProvider;
  let mockContext: MCPContext;
  let mockAction: MCPAction;

  beforeEach(async () => {
    providerManager = new ProviderManager();
    await providerManager.initialize();

    mockProvider1 = new MockMCPProvider('provider-1');
    mockProvider2 = new MockMCPProvider('provider-2', ['context_processing']);

    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'test content',
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
    };

    mockAction = {
      id: 'test-action',
      type: 'explain',
      target: { type: 'selection' },
      parameters: {},
      timestamp: new Date()
    };
  });

  afterEach(async () => {
    await providerManager.destroy();
  });

  describe('provider registration', () => {
    it('should register providers successfully', async () => {
      await providerManager.registerProvider(mockProvider1);

      expect(mockProvider1.initializeCalled).toBe(true);
      
      const provider = providerManager.getProvider('provider-1');
      expect(provider).toBe(mockProvider1);
      
      const providers = providerManager.listProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider1);
    });

    it('should emit registration events', async () => {
      const eventPromise = new Promise((resolve) => {
        providerManager.on('providerRegistered', (event) => {
          expect(event.providerId).toBe('provider-1');
          expect(event.capabilities).toEqual(['context_processing', 'action_execution']);
          resolve(event);
        });
      });

      await providerManager.registerProvider(mockProvider1);
      await eventPromise;
    });

    it('should handle registration failures', async () => {
      mockProvider1.shouldFail = true;

      const eventPromise = new Promise((resolve) => {
        providerManager.on('providerRegistrationFailed', (event) => {
          expect(event.providerId).toBe('provider-1');
          expect(event.error).toContain('Initialization failed');
          resolve(event);
        });
      });

      await expect(providerManager.registerProvider(mockProvider1)).rejects.toThrow('Initialization failed');
      await eventPromise;
    });

    it('should unregister providers', async () => {
      await providerManager.registerProvider(mockProvider1);
      await providerManager.unregisterProvider('provider-1');

      expect(mockProvider1.destroyCalled).toBe(true);
      expect(providerManager.getProvider('provider-1')).toBeNull();
      expect(providerManager.listProviders()).toHaveLength(0);
    });

    it('should emit unregistration events', async () => {
      await providerManager.registerProvider(mockProvider1);

      const eventPromise = new Promise((resolve) => {
        providerManager.on('providerUnregistered', (event) => {
          expect(event.providerId).toBe('provider-1');
          resolve(event);
        });
      });

      await providerManager.unregisterProvider('provider-1');
      await eventPromise;
    });
  });

  describe('provider selection', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(mockProvider1);
      await providerManager.registerProvider(mockProvider2);
    });

    it('should select providers based on capabilities', () => {
      const provider = providerManager.selectProvider({
        requiredCapabilities: ['action_execution']
      });

      expect(provider).toBe(mockProvider1); // Only provider1 has action_execution
    });

    it('should select multiple providers', () => {
      const providers = providerManager.selectProviders({
        requiredCapabilities: ['context_processing']
      });

      expect(providers).toHaveLength(2); // Both providers have context_processing
      expect(providers).toContain(mockProvider1);
      expect(providers).toContain(mockProvider2);
    });

    it('should exclude providers', () => {
      const provider = providerManager.selectProvider({
        excludeProviders: ['provider-1']
      });

      expect(provider).toBe(mockProvider2);
    });

    it('should return null when no suitable providers', () => {
      const provider = providerManager.selectProvider({
        requiredCapabilities: ['non_existent_capability' as any]
      });

      expect(provider).toBeNull();
    });
  });

  describe('provider communication', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(mockProvider1);
      await providerManager.registerProvider(mockProvider2);
    });

    it('should execute actions with fallback', async () => {
      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(true);
    });

    it('should fallback to next provider on failure', async () => {
      mockProvider1.shouldFail = true;

      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(true); // Should succeed with provider2
    });

    it('should fail when all providers fail', async () => {
      mockProvider1.shouldFail = true;
      mockProvider2.shouldFail = true;

      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All providers failed');
    });

    it('should process context with fallback', async () => {
      const result = await providerManager.processContextWithFallback(mockContext);

      expect(result).toBeDefined();
      expect(result?.summary).toBeDefined();
    });

    it('should return null when context processing fails', async () => {
      mockProvider1.shouldFail = true;
      mockProvider2.shouldFail = true;

      const result = await providerManager.processContextWithFallback(mockContext);

      expect(result).toBeNull();
    });
  });

  describe('provider information', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(mockProvider1);
    });

    it('should get provider info', () => {
      const info = providerManager.getProviderInfo('provider-1');

      expect(info).toBeDefined();
      expect(info?.provider).toBe(mockProvider1);
      expect(info?.status).toBe('active');
      expect(info?.capabilities).toEqual(['context_processing', 'action_execution']);
    });

    it('should list provider infos', () => {
      const infos = providerManager.listProviderInfos();

      expect(infos).toHaveLength(1);
      expect(infos[0].provider).toBe(mockProvider1);
    });

    it('should get providers by capability', () => {
      const providers = providerManager.getProvidersByCapability('context_processing');

      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe(mockProvider1);
    });

    it('should get provider metrics', () => {
      const metrics = providerManager.getProviderMetrics('provider-1');

      expect(metrics).toBeDefined();
      expect(metrics?.requestCount).toBe(0);
      expect(metrics?.errorCount).toBe(0);
    });

    it('should get all metrics', () => {
      const allMetrics = providerManager.getAllMetrics();

      expect(allMetrics.size).toBe(1);
      expect(allMetrics.has('provider-1')).toBe(true);
    });
  });

  describe('health checking', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(mockProvider1);
    });

    it('should perform health checks', async () => {
      const result = await providerManager.performHealthCheck('provider-1');

      expect(result).toBe(true);
    });

    it('should handle health check failures', async () => {
      mockProvider1.shouldFail = true;

      const eventPromise = new Promise((resolve) => {
        providerManager.on('healthCheckFailed', (event) => {
          expect(event.providerId).toBe('provider-1');
          resolve(event);
        });
      });

      const result = await providerManager.performHealthCheck('provider-1');

      expect(result).toBe(false);
      await eventPromise;
    });

    it('should emit health check passed events', async () => {
      const eventPromise = new Promise((resolve) => {
        providerManager.on('healthCheckPassed', (event) => {
          expect(event.providerId).toBe('provider-1');
          resolve(event);
        });
      });

      await providerManager.performHealthCheck('provider-1');
      await eventPromise;
    });
  });

  describe('metrics tracking', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(mockProvider1);
    });

    it('should update metrics on successful execution', async () => {
      await providerManager.executeWithFallback(mockAction, mockContext);

      const metrics = providerManager.getProviderMetrics('provider-1');
      expect(metrics?.requestCount).toBe(1);
      expect(metrics?.errorCount).toBe(0);
    });

    it('should update metrics on failed execution', async () => {
      mockProvider1.shouldFail = true;

      await providerManager.executeWithFallback(mockAction, mockContext);

      const metrics = providerManager.getProviderMetrics('provider-1');
      expect(metrics?.requestCount).toBe(1);
      expect(metrics?.errorCount).toBe(1);
    });
  });
});