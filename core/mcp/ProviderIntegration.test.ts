/**
 * Integration tests for MCP provider integration and management
 * Tests the complete provider lifecycle, communication, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderManager } from './ProviderManager.js';
import { CommunicationProtocol } from './CommunicationProtocol.js';
import { MCPClientImpl } from './MCPClient.js';
import { BaseMCPProvider } from './BaseMCPProvider.js';
import type { 
  MCPProvider, 
  MCPContext, 
  MCPAction, 
  ActionResult, 
  ProcessedContext,
  MCPCapability 
} from './types.js';

// Advanced mock provider for testing
class AdvancedMockProvider extends BaseMCPProvider {
  public initializeDelay = 0;
  public processDelay = 0;
  public executeDelay = 0;
  public shouldFailInit = false;
  public shouldFailProcess = false;
  public shouldFailExecute = false;
  public failureRate = 0; // 0-1, probability of failure
  public requestCount = 0;

  constructor(
    id: string, 
    name: string, 
    capabilities: MCPCapability[] = ['context_processing', 'action_execution']
  ) {
    super(id, name, capabilities);
  }

  async initialize(): Promise<void> {
    if (this.initializeDelay > 0) {
      await this.delay(this.initializeDelay);
    }
    
    if (this.shouldFailInit) {
      throw new Error(`Provider ${this.id} initialization failed`);
    }
  }

  async processContext(context: MCPContext): Promise<ProcessedContext> {
    this.requestCount++;
    
    if (this.processDelay > 0) {
      await this.delay(this.processDelay);
    }

    if (this.shouldFailProcess || Math.random() < this.failureRate) {
      throw new Error(`Provider ${this.id} context processing failed`);
    }

    return {
      summary: `Processed by ${this.name}`,
      relevantFiles: ['test.js'],
      suggestions: [`Suggestion from ${this.name}`],
      metadata: { 
        providerId: this.id,
        requestCount: this.requestCount
      }
    };
  }

  async executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    this.requestCount++;
    
    if (this.executeDelay > 0) {
      await this.delay(this.executeDelay);
    }

    if (this.shouldFailExecute || Math.random() < this.failureRate) {
      return this.createErrorResult(`Provider ${this.id} action execution failed`);
    }

    return this.createSuccessResult([], {
      providerId: this.id,
      actionType: action.type,
      requestCount: this.requestCount
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test utilities
  reset(): void {
    this.requestCount = 0;
    this.shouldFailInit = false;
    this.shouldFailProcess = false;
    this.shouldFailExecute = false;
    this.failureRate = 0;
  }
}

describe('MCP Provider Integration', () => {
  let providerManager: ProviderManager;
  let communicationProtocol: CommunicationProtocol;
  let mcpClient: MCPClientImpl;
  let fastProvider: AdvancedMockProvider;
  let slowProvider: AdvancedMockProvider;
  let unreliableProvider: AdvancedMockProvider;
  let mockContext: MCPContext;
  let mockAction: MCPAction;

  beforeEach(async () => {
    providerManager = new ProviderManager();
    communicationProtocol = new CommunicationProtocol({
      timeout: 2000,
      retryAttempts: 2,
      retryDelay: 100
    });
    mcpClient = new MCPClientImpl({
      enableRealTimeUpdates: false,
      contextUpdateInterval: 1000,
      maxHistorySize: 50,
      enableActionHistory: true
    });

    // Create test providers
    fastProvider = new AdvancedMockProvider('fast-provider', 'Fast Provider');
    slowProvider = new AdvancedMockProvider('slow-provider', 'Slow Provider');
    slowProvider.processDelay = 500;
    slowProvider.executeDelay = 500;

    unreliableProvider = new AdvancedMockProvider('unreliable-provider', 'Unreliable Provider');
    unreliableProvider.failureRate = 0.3; // 30% failure rate

    // Initialize components
    await providerManager.initialize();
    await mcpClient.initialize();

    // Create test data
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'function test() { return true; }',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false
      },
      project: {
        structure: {
          'test.js': { type: 'file', content: 'console.log("test");' }
        },
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
    await mcpClient.destroy();
    
    // Reset providers
    fastProvider.reset();
    slowProvider.reset();
    unreliableProvider.reset();
  });

  describe('Provider Registration and Management', () => {
    it('should register multiple providers successfully', async () => {
      await providerManager.registerProvider(fastProvider);
      await providerManager.registerProvider(slowProvider);
      await providerManager.registerProvider(unreliableProvider);

      const providers = providerManager.listProviders();
      expect(providers).toHaveLength(3);
      
      const providerIds = providers.map(p => p.id);
      expect(providerIds).toContain('fast-provider');
      expect(providerIds).toContain('slow-provider');
      expect(providerIds).toContain('unreliable-provider');
    });

    it('should handle provider registration failures gracefully', async () => {
      fastProvider.shouldFailInit = true;

      const registrationPromise = providerManager.registerProvider(fastProvider);
      await expect(registrationPromise).rejects.toThrow('initialization failed');

      // Should not be registered
      expect(providerManager.getProvider('fast-provider')).toBeNull();
    });

    it('should detect provider capabilities correctly', async () => {
      await providerManager.registerProvider(fastProvider);

      const capabilities = providerManager.detectProviderCapabilities('fast-provider');
      expect(capabilities).toEqual(['context_processing', 'action_execution']);
    });

    it('should route actions to appropriate providers', async () => {
      // Register providers with different capabilities
      const contextOnlyProvider = new AdvancedMockProvider(
        'context-only', 
        'Context Only Provider', 
        ['context_processing']
      );
      const actionOnlyProvider = new AdvancedMockProvider(
        'action-only', 
        'Action Only Provider', 
        ['action_execution']
      );

      await providerManager.registerProvider(contextOnlyProvider);
      await providerManager.registerProvider(actionOnlyProvider);

      // Wait for health checks to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const routedProvider = providerManager.routeActionToProvider(mockAction);
      expect(routedProvider?.id).toBe('action-only');
    });
  });

  describe('Provider Selection and Routing', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(fastProvider);
      await providerManager.registerProvider(slowProvider);
      await providerManager.registerProvider(unreliableProvider);
    });

    it('should select providers based on performance criteria', () => {
      const provider = providerManager.selectProvider({
        maxResponseTime: 100, // Fast provider should be selected
        minSuccessRate: 0.8
      });

      expect(provider?.id).toBe('fast-provider');
    });

    it('should respect preferred providers', () => {
      const provider = providerManager.selectProvider({
        preferredProviders: ['slow-provider']
      });

      expect(provider?.id).toBe('slow-provider');
    });

    it('should exclude specified providers', async () => {
      // Wait for health checks to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const provider = providerManager.selectProvider({
        excludeProviders: ['fast-provider', 'slow-provider']
      });

      expect(provider?.id).toBe('unreliable-provider');
    });

    it('should route context processing to appropriate providers', () => {
      const provider = providerManager.routeContextToProvider('buffer');
      expect(provider).toBeDefined();
      expect(provider?.capabilities).toContain('context_processing');
    });
  });

  describe('Provider Communication and Fallback', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(fastProvider);
      await providerManager.registerProvider(slowProvider);
      await providerManager.registerProvider(unreliableProvider);
    });

    it('should execute actions with successful provider', async () => {
      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(true);
      expect(result.metadata?.providerId).toBeDefined();
    });

    it('should fallback to next provider on failure', async () => {
      // Make first provider fail
      fastProvider.shouldFailExecute = true;

      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(true);
      // Should succeed with slow provider
      expect(result.metadata?.providerId).toBe('slow-provider');
    });

    it('should process context with fallback', async () => {
      const result = await providerManager.processContextWithFallback(mockContext);

      expect(result).toBeDefined();
      expect(result?.summary).toContain('Processed by');
    });

    it('should handle all providers failing', async () => {
      // Make all providers fail
      fastProvider.shouldFailExecute = true;
      slowProvider.shouldFailExecute = true;
      unreliableProvider.shouldFailExecute = true;

      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All providers failed');
      expect(result.metadata?.attemptedProviders).toHaveLength(3);
    });
  });

  describe('Provider Error Handling and Recovery', () => {
    it('should handle provider errors and update metrics', async () => {
      // Register only unreliable provider
      await providerManager.registerProvider(unreliableProvider);
      unreliableProvider.shouldFailExecute = true;

      const result = await providerManager.executeWithFallback(mockAction, mockContext);

      expect(result.success).toBe(false);
      const metrics = providerManager.getProviderMetrics('unreliable-provider');
      expect(metrics?.errorCount).toBeGreaterThan(0);
    });

    it('should mark providers as unhealthy after repeated failures', async () => {
      await providerManager.registerProvider(unreliableProvider);
      unreliableProvider.shouldFailExecute = true;

      // Execute multiple times to trigger unhealthy status
      for (let i = 0; i < 6; i++) {
        await providerManager.executeWithFallback({
          ...mockAction,
          id: `action-${i}`
        }, mockContext);
      }

      const info = providerManager.getProviderInfo('unreliable-provider');
      expect(info?.status).toBe('error');
    });

    it('should use circuit breaker pattern', async () => {
      await providerManager.registerProvider(unreliableProvider);
      
      // Cause multiple failures to open circuit
      unreliableProvider.failureRate = 1.0; // 100% failure rate

      for (let i = 0; i < 15; i++) {
        await providerManager.executeWithFallback({
          ...mockAction,
          id: `action-${i}`
        }, mockContext);
      }

      const isCircuitOpen = providerManager.isProviderCircuitOpen('unreliable-provider');
      expect(isCircuitOpen).toBe(true);
    });

    it('should attempt provider recovery', async () => {
      await providerManager.registerProvider(unreliableProvider);
      
      // Mark provider as unhealthy
      unreliableProvider.shouldFailExecute = true;
      for (let i = 0; i < 6; i++) {
        await providerManager.executeWithFallback({
          ...mockAction,
          id: `action-${i}`
        }, mockContext);
      }

      // Verify provider is marked as error
      let info = providerManager.getProviderInfo('unreliable-provider');
      expect(info?.status).toBe('error');

      // Reset provider to healthy state
      unreliableProvider.shouldFailExecute = false;
      unreliableProvider.shouldFailProcess = false;
      unreliableProvider.failureRate = 0;

      const recovered = await providerManager.attemptProviderRecovery('unreliable-provider');
      expect(recovered).toBe(true);

      info = providerManager.getProviderInfo('unreliable-provider');
      expect(info?.status).toBe('active');
    });
  });

  describe('Communication Protocol Integration', () => {
    beforeEach(async () => {
      await providerManager.registerProvider(fastProvider);
    });

    it('should handle context processing through protocol', async () => {
      const result = await communicationProtocol.requestContextProcessing(
        fastProvider, 
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.summary).toContain('Processed by Fast Provider');
    });

    it('should handle action execution through protocol', async () => {
      const result = await communicationProtocol.requestActionExecution(
        fastProvider, 
        mockAction, 
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.providerId).toBe('fast-provider');
    });

    it('should handle protocol timeouts', async () => {
      slowProvider.executeDelay = 3000; // Longer than protocol timeout

      await expect(
        communicationProtocol.requestActionExecution(
          slowProvider, 
          mockAction, 
          mockContext
        )
      ).rejects.toThrow('timed out');
    });

    it('should support request cancellation', async () => {
      slowProvider.executeDelay = 5000;

      const requestPromise = communicationProtocol.requestActionExecution(
        slowProvider, 
        mockAction, 
        mockContext
      );

      // Cancel after a short delay
      setTimeout(() => {
        const activeCount = communicationProtocol.getActiveRequestCount();
        expect(activeCount).toBeGreaterThan(0);
        communicationProtocol.cancelAllRequests();
      }, 100);

      await expect(requestPromise).rejects.toThrow();
    });

    it('should perform health checks', async () => {
      const isHealthy = await communicationProtocol.ping(fastProvider);
      expect(isHealthy).toBe(true);

      fastProvider.shouldFailProcess = true;
      const isUnhealthy = await communicationProtocol.ping(fastProvider);
      expect(isUnhealthy).toBe(false);
    });
  });

  describe('End-to-End Provider Integration', () => {
    it('should integrate providers with MCP client', async () => {
      await mcpClient.registerProvider(fastProvider);
      await mcpClient.registerProvider(slowProvider);

      const providers = mcpClient.listProviders();
      expect(providers).toHaveLength(2);

      const result = await mcpClient.executeAction(mockAction);
      expect(result.success).toBe(true);
    });

    it('should handle provider metrics and monitoring', async () => {
      await mcpClient.registerProvider(fastProvider);

      // Execute several actions
      for (let i = 0; i < 5; i++) {
        await mcpClient.executeAction({
          ...mockAction,
          id: `action-${i}`
        });
      }

      const fastMetrics = mcpClient.getProviderMetrics('fast-provider');
      expect(fastMetrics?.requestCount).toBeGreaterThan(0);
    });

    it('should maintain provider health monitoring', async () => {
      await mcpClient.registerProvider(fastProvider);

      let healthCheckPassed = false;
      mcpClient.on('healthCheckPassed', (event) => {
        if (event.providerId === 'fast-provider') {
          healthCheckPassed = true;
        }
      });

      // Manually trigger health check
      const providerManager = (mcpClient as any).providerManager;
      await providerManager.performHealthCheck('fast-provider');

      expect(healthCheckPassed).toBe(true);
    });
  });

  describe('Provider Capability Detection', () => {
    it('should detect and validate provider capabilities', async () => {
      const realtimeProvider = new AdvancedMockProvider(
        'realtime-provider',
        'Realtime Provider',
        ['context_processing', 'real_time_updates']
      );

      await providerManager.registerProvider(realtimeProvider);

      const capabilities = providerManager.detectProviderCapabilities('realtime-provider');
      expect(capabilities).toContain('real_time_updates');

      const realtimeProviders = providerManager.getProvidersByCapability('real_time_updates');
      expect(realtimeProviders).toHaveLength(1);
      expect(realtimeProviders[0].id).toBe('realtime-provider');
    });

    it('should route based on capability requirements', async () => {
      const basicProvider = new AdvancedMockProvider(
        'basic-provider',
        'Basic Provider',
        ['context_processing']
      );

      const advancedProvider = new AdvancedMockProvider(
        'advanced-provider',
        'Advanced Provider',
        ['context_processing', 'action_execution', 'rollback_support']
      );

      await providerManager.registerProvider(basicProvider);
      await providerManager.registerProvider(advancedProvider);

      // Should select advanced provider for actions requiring rollback
      const provider = providerManager.selectProvider({
        requiredCapabilities: ['action_execution', 'rollback_support']
      });

      expect(provider?.id).toBe('advanced-provider');
    });
  });
});