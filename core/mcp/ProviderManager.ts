/**
 * Provider Manager - Manages MCP provider registration, communication, and capabilities
 * Handles provider lifecycle, capability detection, and routing
 */

import type {
  MCPProvider,
  MCPProviderId,
  MCPCapability,
  MCPContext,
  MCPAction,
  ActionResult,
  ProcessedContext
} from './types.js';

import { EventEmitter } from 'events';

export interface ProviderInfo {
  provider: MCPProvider;
  status: ProviderStatus;
  capabilities: MCPCapability[];
  lastHealthCheck: Date;
  errorCount: number;
  averageResponseTime: number;
  totalRequests: number;
}

export type ProviderStatus = 'active' | 'inactive' | 'error' | 'initializing';

export interface ProviderMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  lastErrorTime?: Date;
}

export interface ProviderSelectionCriteria {
  requiredCapabilities?: MCPCapability[];
  preferredProviders?: MCPProviderId[];
  excludeProviders?: MCPProviderId[];
  maxResponseTime?: number;
  minSuccessRate?: number;
}

export class ProviderManager extends EventEmitter {
  private providers: Map<MCPProviderId, ProviderInfo> = new Map();
  private metrics: Map<MCPProviderId, ProviderMetrics> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private healthCheckIntervalMs: number = 30000; // 30 seconds

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    // Start health check monitoring
    this.startHealthChecking();
  }

  async destroy(): Promise<void> {
    // Stop health checking
    this.stopHealthChecking();

    // Destroy all providers
    for (const [providerId, info] of this.providers) {
      try {
        if (info.provider.destroy) {
          await info.provider.destroy();
        }
      } catch (error) {
        console.error(`Error destroying provider ${providerId}:`, error);
      }
    }

    this.providers.clear();
    this.metrics.clear();
    this.removeAllListeners();
  }

  // Provider registration and management
  async registerProvider(provider: MCPProvider): Promise<void> {
    try {
      // Initialize the provider if it has an initialize method
      if (provider.initialize) {
        await provider.initialize();
      }

      const info: ProviderInfo = {
        provider,
        status: 'initializing',
        capabilities: [...provider.capabilities],
        lastHealthCheck: new Date(),
        errorCount: 0,
        averageResponseTime: 0,
        totalRequests: 0
      };

      this.providers.set(provider.id, info);
      this.metrics.set(provider.id, {
        requestCount: 0,
        errorCount: 0,
        averageResponseTime: 0
      });

      // Perform initial health check
      await this.performHealthCheck(provider.id);

      this.emit('providerRegistered', { providerId: provider.id, capabilities: provider.capabilities });
    } catch (error) {
      this.emit('providerRegistrationFailed', { 
        providerId: provider.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  async unregisterProvider(providerId: MCPProviderId): Promise<void> {
    const info = this.providers.get(providerId);
    if (!info) {
      return;
    }

    try {
      // Destroy the provider
      if (info.provider.destroy) {
        await info.provider.destroy();
      }

      this.providers.delete(providerId);
      this.metrics.delete(providerId);

      this.emit('providerUnregistered', { providerId });
    } catch (error) {
      console.error(`Error unregistering provider ${providerId}:`, error);
      this.emit('providerUnregistrationFailed', { 
        providerId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Provider selection and routing
  selectProvider(criteria: ProviderSelectionCriteria = {}): MCPProvider | null {
    const candidates = this.getEligibleProviders(criteria);
    
    if (candidates.length === 0) {
      return null;
    }

    // Apply preferred providers first
    if (criteria.preferredProviders && criteria.preferredProviders.length > 0) {
      const preferred = candidates.filter(info => 
        criteria.preferredProviders!.includes(info.provider.id)
      );
      if (preferred.length > 0) {
        preferred.sort((a, b) => this.compareProviders(a, b));
        return preferred[0].provider;
      }
    }

    // Sort by priority (success rate, response time, etc.)
    candidates.sort((a, b) => this.compareProviders(a, b));
    
    return candidates[0].provider;
  }

  selectProviders(criteria: ProviderSelectionCriteria = {}): MCPProvider[] {
    const candidates = this.getEligibleProviders(criteria);
    
    // Sort by priority
    candidates.sort((a, b) => this.compareProviders(a, b));
    
    return candidates.map(info => info.provider);
  }

  // Provider communication with fallback
  async executeWithFallback(
    action: MCPAction,
    context: MCPContext,
    criteria: ProviderSelectionCriteria = {}
  ): Promise<ActionResult> {
    const providers = this.selectProviders(criteria);
    
    if (providers.length === 0) {
      return {
        success: false,
        error: 'No suitable providers available'
      };
    }

    let lastError: string | undefined;
    const attemptedProviders: string[] = [];

    for (const provider of providers) {
      attemptedProviders.push(provider.id);
      
      try {
        const startTime = Date.now();
        const result = await provider.executeAction(action, context);
        const responseTime = Date.now() - startTime;

        // Update metrics
        this.updateMetrics(provider.id, responseTime, result.success);

        if (result.success) {
          this.emit('actionExecuted', { 
            providerId: provider.id, 
            actionId: action.id, 
            responseTime,
            attemptedProviders
          });
          return result;
        } else {
          lastError = result.error;
          this.emit('providerActionFailed', {
            providerId: provider.id,
            actionId: action.id,
            error: result.error,
            willRetry: providers.indexOf(provider) < providers.length - 1
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        lastError = errorMessage;
        
        // Update error metrics and potentially mark provider as unhealthy
        this.updateMetrics(provider.id, 0, false);
        await this.handleProviderError(provider.id, error);
        
        this.emit('providerError', { 
          providerId: provider.id, 
          actionId: action.id, 
          error: errorMessage,
          willRetry: providers.indexOf(provider) < providers.length - 1
        });
      }
    }

    this.emit('allProvidersFailed', {
      actionId: action.id,
      attemptedProviders,
      lastError
    });

    return {
      success: false,
      error: `All providers failed. Attempted: ${attemptedProviders.join(', ')}. Last error: ${lastError}`,
      metadata: {
        attemptedProviders,
        totalAttempts: attemptedProviders.length
      }
    };
  }

  async processContextWithFallback(
    context: MCPContext,
    criteria: ProviderSelectionCriteria = {}
  ): Promise<ProcessedContext | null> {
    const providers = this.selectProviders({
      ...criteria,
      requiredCapabilities: ['context_processing', ...(criteria.requiredCapabilities || [])]
    });

    for (const provider of providers) {
      try {
        const startTime = Date.now();
        const result = await provider.processContext(context);
        const responseTime = Date.now() - startTime;

        this.updateMetrics(provider.id, responseTime, true);
        
        this.emit('contextProcessed', { 
          providerId: provider.id, 
          contextId: context.id, 
          responseTime 
        });
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.updateMetrics(provider.id, 0, false);
        
        this.emit('providerError', { 
          providerId: provider.id, 
          contextId: context.id, 
          error: errorMessage 
        });
      }
    }

    return null;
  }

  // Provider information and status
  getProvider(providerId: MCPProviderId): MCPProvider | null {
    const info = this.providers.get(providerId);
    return info ? info.provider : null;
  }

  getProviderInfo(providerId: MCPProviderId): ProviderInfo | null {
    return this.providers.get(providerId) || null;
  }

  listProviders(): MCPProvider[] {
    return Array.from(this.providers.values()).map(info => info.provider);
  }

  listProviderInfos(): ProviderInfo[] {
    return Array.from(this.providers.values());
  }

  getProvidersByCapability(capability: MCPCapability): MCPProvider[] {
    return Array.from(this.providers.values())
      .filter(info => info.capabilities.includes(capability) && info.status === 'active')
      .map(info => info.provider);
  }

  // Enhanced capability detection and routing
  detectProviderCapabilities(providerId: MCPProviderId): MCPCapability[] {
    const info = this.providers.get(providerId);
    if (!info) {
      return [];
    }

    // Return current capabilities - in a real implementation, this could
    // dynamically test capabilities
    return [...info.capabilities];
  }

  routeActionToProvider(action: MCPAction): MCPProvider | null {
    const requiredCapabilities: MCPCapability[] = ['action_execution'];
    
    // Add specific capabilities based on action type
    switch (action.type) {
      case 'refactor':
      case 'optimize':
        requiredCapabilities.push('context_processing');
        break;
      case 'document':
      case 'explain':
        requiredCapabilities.push('context_processing');
        break;
    }

    return this.selectProvider({
      requiredCapabilities,
      maxResponseTime: 10000, // 10 seconds max for actions
      minSuccessRate: 0.8 // 80% success rate minimum
    });
  }

  routeContextToProvider(contextType: 'full' | 'buffer' | 'project' | 'execution'): MCPProvider | null {
    const criteria: ProviderSelectionCriteria = {
      requiredCapabilities: ['context_processing'],
      maxResponseTime: 5000, // 5 seconds max for context processing
      minSuccessRate: 0.9 // 90% success rate for context processing
    };

    // Prefer providers with real-time updates for frequent context changes
    if (contextType === 'buffer') {
      const realtimeProviders = this.getProvidersByCapability('real_time_updates');
      if (realtimeProviders.length > 0) {
        criteria.preferredProviders = realtimeProviders.map(p => p.id);
      }
    }

    return this.selectProvider(criteria);
  }

  getProviderMetrics(providerId: MCPProviderId): ProviderMetrics | null {
    return this.metrics.get(providerId) || null;
  }

  getAllMetrics(): Map<MCPProviderId, ProviderMetrics> {
    return new Map(this.metrics);
  }

  // Health checking
  async performHealthCheck(providerId: MCPProviderId): Promise<boolean> {
    const info = this.providers.get(providerId);
    if (!info) {
      return false;
    }

    try {
      // Simple health check - try to process a minimal context
      const testContext: MCPContext = {
        id: 'health-check',
        timestamp: new Date(),
        buffer: {
          content: '',
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

      if (info.capabilities.includes('context_processing')) {
        await info.provider.processContext(testContext);
      }

      // Update status
      info.status = 'active';
      info.lastHealthCheck = new Date();
      info.errorCount = Math.max(0, info.errorCount - 1); // Reduce error count on success

      this.emit('healthCheckPassed', { providerId });
      return true;
    } catch (error) {
      info.status = 'error';
      info.errorCount++;
      info.lastHealthCheck = new Date();

      this.emit('healthCheckFailed', { 
        providerId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  }

  // Provider error handling and recovery
  async handleProviderError(providerId: MCPProviderId, error: unknown): Promise<void> {
    const info = this.providers.get(providerId);
    if (!info) {
      return;
    }

    // Increment error count
    info.errorCount++;

    // If error count exceeds threshold, mark as unhealthy
    if (info.errorCount >= 5) {
      info.status = 'error';
      this.emit('providerMarkedUnhealthy', { 
        providerId, 
        errorCount: info.errorCount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Attempt recovery for certain error types
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('network')) {
        // Schedule a recovery attempt
        setTimeout(() => this.attemptProviderRecovery(providerId), 5000);
      }
    }
  }

  async attemptProviderRecovery(providerId: MCPProviderId): Promise<boolean> {
    const info = this.providers.get(providerId);
    if (!info || info.status !== 'error') {
      return false;
    }

    try {
      // Try to reinitialize the provider
      if (info.provider.initialize) {
        await info.provider.initialize();
      }

      // Perform health check
      const isHealthy = await this.performHealthCheck(providerId);
      
      if (isHealthy) {
        info.status = 'active';
        info.errorCount = Math.max(0, info.errorCount - 2); // Reduce error count on recovery
        
        this.emit('providerRecovered', { 
          providerId,
          errorCount: info.errorCount
        });
        
        return true;
      }
    } catch (error) {
      this.emit('providerRecoveryFailed', { 
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return false;
  }

  // Provider circuit breaker pattern
  isProviderCircuitOpen(providerId: MCPProviderId): boolean {
    const info = this.providers.get(providerId);
    if (!info) {
      return true;
    }

    // Circuit is open if provider has too many recent errors
    const metrics = this.metrics.get(providerId);
    if (metrics && metrics.requestCount > 10) {
      const errorRate = metrics.errorCount / metrics.requestCount;
      return errorRate > 0.5; // More than 50% error rate
    }

    return info.errorCount >= 3;
  }

  // Private methods
  private getEligibleProviders(criteria: ProviderSelectionCriteria): ProviderInfo[] {
    return Array.from(this.providers.values()).filter(info => {
      // Check status
      if (info.status !== 'active') {
        return false;
      }

      // Check circuit breaker
      if (this.isProviderCircuitOpen(info.provider.id)) {
        return false;
      }

      // Check required capabilities
      if (criteria.requiredCapabilities) {
        const hasAllCapabilities = criteria.requiredCapabilities.every(cap => 
          info.capabilities.includes(cap)
        );
        if (!hasAllCapabilities) {
          return false;
        }
      }

      // Check excluded providers
      if (criteria.excludeProviders?.includes(info.provider.id)) {
        return false;
      }

      // Check response time
      if (criteria.maxResponseTime && info.averageResponseTime > criteria.maxResponseTime) {
        return false;
      }

      // Check success rate
      if (criteria.minSuccessRate) {
        const metrics = this.metrics.get(info.provider.id);
        if (metrics && metrics.requestCount > 0) {
          const successRate = (metrics.requestCount - metrics.errorCount) / metrics.requestCount;
          if (successRate < criteria.minSuccessRate) {
            return false;
          }
        }
      }

      return true;
    });
  }

  private compareProviders(a: ProviderInfo, b: ProviderInfo): number {
    // Prefer providers with fewer errors
    if (a.errorCount !== b.errorCount) {
      return a.errorCount - b.errorCount;
    }

    // Prefer providers with better response times
    if (a.averageResponseTime !== b.averageResponseTime) {
      return a.averageResponseTime - b.averageResponseTime;
    }

    // Prefer providers with more requests (more established)
    return b.totalRequests - a.totalRequests;
  }

  private updateMetrics(providerId: MCPProviderId, responseTime: number, success: boolean): void {
    const info = this.providers.get(providerId);
    const metrics = this.metrics.get(providerId);
    
    if (!info || !metrics) {
      return;
    }

    // Update request count
    metrics.requestCount++;
    info.totalRequests++;
    metrics.lastRequestTime = new Date();

    // Update error count
    if (!success) {
      metrics.errorCount++;
      info.errorCount++;
      metrics.lastErrorTime = new Date();
    }

    // Update average response time
    if (responseTime > 0) {
      const totalTime = info.averageResponseTime * (info.totalRequests - 1) + responseTime;
      info.averageResponseTime = totalTime / info.totalRequests;
      metrics.averageResponseTime = info.averageResponseTime;
    }
  }

  private startHealthChecking(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      const providerIds = Array.from(this.providers.keys());
      
      for (const providerId of providerIds) {
        try {
          await this.performHealthCheck(providerId);
        } catch (error) {
          console.error(`Health check failed for provider ${providerId}:`, error);
        }
      }
    }, this.healthCheckIntervalMs);
  }

  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}