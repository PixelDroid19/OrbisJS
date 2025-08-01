/**
 * Model Context Protocol (MCP) Client Implementation
 * Provides rich context collection and action execution for AI assistants
 */

import type {
  MCPClient,
  MCPContext,
  MCPAction,
  MCPActionId,
  MCPProvider,
  MCPProviderId,
  ActionResult,
  ProjectContext,
  ExecutionContext,
  MCPClientConfig,
  MCPContextChangeEvent,
  ContextChange,
  MCPError,
  MCPCapability
} from './types.js';

import { ContextCollector } from './ContextCollector.js';
import { ActionExecutor } from './ActionExecutor.js';
import { ProviderManager } from './ProviderManager.js';
import { CommunicationProtocol } from './CommunicationProtocol.js';
import { EventEmitter } from 'events';

export class MCPClientImpl extends EventEmitter implements MCPClient {
  private contextCollector: ContextCollector;
  private actionExecutor: ActionExecutor;
  private providerManager: ProviderManager;
  private communicationProtocol: CommunicationProtocol;
  private config: MCPClientConfig;
  private contextUpdateTimer?: NodeJS.Timeout;
  private lastContext?: MCPContext;
  private contextChangeCallbacks: Set<(context: MCPContext) => void> = new Set();

  constructor(config?: Partial<MCPClientConfig>) {
    super();
    
    this.config = {
      enableRealTimeUpdates: true,
      contextUpdateInterval: 1000, // 1 second
      maxHistorySize: 100,
      enableActionHistory: true,
      ...config
    };

    this.contextCollector = new ContextCollector();
    this.actionExecutor = new ActionExecutor(this.config);
    this.providerManager = new ProviderManager();
    this.communicationProtocol = new CommunicationProtocol();
  }

  async initialize(): Promise<void> {
    try {
      await this.contextCollector.initialize();
      await this.actionExecutor.initialize();
      await this.providerManager.initialize();

      // Set up provider manager event forwarding
      this.setupProviderManagerEvents();

      // Start real-time context updates if enabled
      if (this.config.enableRealTimeUpdates) {
        this.startContextUpdates();
      }
    } catch (error) {
      throw this.createMCPError(
        'CONTEXT_COLLECTION_FAILED',
        `Failed to initialize MCP client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async destroy(): Promise<void> {
    // Stop context updates
    this.stopContextUpdates();

    // Clear callbacks
    this.contextChangeCallbacks.clear();

    // Destroy components
    await this.providerManager.destroy();
    await this.contextCollector.destroy();
    await this.actionExecutor.destroy();

    // Remove all listeners
    this.removeAllListeners();
  }

  // Context collection methods
  async getCurrentContext(): Promise<MCPContext> {
    try {
      return await this.contextCollector.collectContext();
    } catch (error) {
      throw this.createMCPError(
        'CONTEXT_COLLECTION_FAILED',
        `Failed to collect current context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getProjectContext(): Promise<ProjectContext> {
    try {
      return await this.contextCollector.collectProjectContext();
    } catch (error) {
      throw this.createMCPError(
        'CONTEXT_COLLECTION_FAILED',
        `Failed to collect project context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getExecutionContext(): Promise<ExecutionContext> {
    try {
      return await this.contextCollector.collectExecutionContext();
    } catch (error) {
      throw this.createMCPError(
        'CONTEXT_COLLECTION_FAILED',
        `Failed to collect execution context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Context change notifications
  onContextChange(callback: (context: MCPContext) => void): void {
    this.contextChangeCallbacks.add(callback);
  }

  offContextChange(callback: (context: MCPContext) => void): void {
    this.contextChangeCallbacks.delete(callback);
  }

  // Action execution
  async executeAction(action: MCPAction): Promise<ActionResult> {
    try {
      const context = await this.getCurrentContext();
      
      // Try provider manager first for better routing and fallback
      const providerResult = await this.providerManager.executeWithFallback(action, context);
      if (providerResult.success) {
        this.emit('actionExecuted', { action, result: providerResult, context });
        return providerResult;
      }

      // Fall back to action executor
      const providers = new Map(
        this.providerManager.listProviders().map(p => [p.id, p])
      );
      const result = await this.actionExecutor.executeAction(action, context, providers);
      
      // Emit action executed event
      this.emit('actionExecuted', { action, result, context });
      
      return result;
    } catch (error) {
      throw this.createMCPError(
        'ACTION_EXECUTION_FAILED',
        `Failed to execute action ${action.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        action.id
      );
    }
  }

  async rollbackAction(actionId: MCPActionId): Promise<boolean> {
    try {
      const success = await this.actionExecutor.rollbackAction(actionId);
      
      if (success) {
        this.emit('actionRolledBack', { actionId });
      }
      
      return success;
    } catch (error) {
      throw this.createMCPError(
        'ROLLBACK_FAILED',
        `Failed to rollback action ${actionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        actionId
      );
    }
  }

  // Provider management
  async registerProvider(provider: MCPProvider): Promise<void> {
    await this.providerManager.registerProvider(provider);
    // Event will be emitted by provider manager and forwarded
  }

  async unregisterProvider(providerId: MCPProviderId): Promise<void> {
    await this.providerManager.unregisterProvider(providerId);
    // Event will be emitted by provider manager and forwarded
  }

  getProvider(providerId: MCPProviderId): MCPProvider | null {
    return this.providerManager.getProvider(providerId);
  }

  listProviders(): MCPProvider[] {
    return this.providerManager.listProviders();
  }

  // Enhanced provider management methods
  getProviderInfo(providerId: MCPProviderId) {
    return this.providerManager.getProviderInfo(providerId);
  }

  getProvidersByCapability(capability: MCPCapability) {
    return this.providerManager.getProvidersByCapability(capability);
  }

  getProviderMetrics(providerId: MCPProviderId) {
    return this.providerManager.getProviderMetrics(providerId);
  }

  getAllProviderMetrics() {
    return this.providerManager.getAllMetrics();
  }

  // Action history
  getActionHistory(): MCPAction[] {
    return this.actionExecutor.getActionHistory();
  }

  clearActionHistory(): void {
    this.actionExecutor.clearActionHistory();
    this.emit('actionHistoryCleared');
  }

  // Private methods
  private setupProviderManagerEvents(): void {
    // Forward provider manager events
    this.providerManager.on('providerRegistered', (event) => {
      this.emit('providerRegistered', event);
    });

    this.providerManager.on('providerUnregistered', (event) => {
      this.emit('providerUnregistered', event);
    });

    this.providerManager.on('providerError', (event) => {
      this.emit('providerError', event);
    });

    this.providerManager.on('healthCheckPassed', (event) => {
      this.emit('healthCheckPassed', event);
    });

    this.providerManager.on('healthCheckFailed', (event) => {
      this.emit('healthCheckFailed', event);
    });
  }

  private startContextUpdates(): void {
    if (this.contextUpdateTimer) {
      return;
    }

    this.contextUpdateTimer = setInterval(async () => {
      try {
        const currentContext = await this.getCurrentContext();
        
        if (this.hasContextChanged(currentContext)) {
          const changes = this.calculateContextChanges(this.lastContext, currentContext);
          
          // Notify callbacks
          for (const callback of this.contextChangeCallbacks) {
            try {
              callback(currentContext);
            } catch (error) {
              console.error('Error in context change callback:', error);
            }
          }

          // Emit event
          const event: MCPContextChangeEvent = {
            type: 'context_change',
            context: currentContext,
            changes
          };
          this.emit('contextChange', event);

          this.lastContext = currentContext;
        }
      } catch (error) {
        console.error('Error during context update:', error);
      }
    }, this.config.contextUpdateInterval);
  }

  private stopContextUpdates(): void {
    if (this.contextUpdateTimer) {
      clearInterval(this.contextUpdateTimer);
      this.contextUpdateTimer = undefined;
    }
  }

  private hasContextChanged(newContext: MCPContext): boolean {
    if (!this.lastContext) {
      return true;
    }

    // Simple comparison - in a real implementation, you might want more sophisticated comparison
    return JSON.stringify(this.lastContext) !== JSON.stringify(newContext);
  }

  private calculateContextChanges(oldContext: MCPContext | undefined, newContext: MCPContext): ContextChange[] {
    const changes: ContextChange[] = [];

    if (!oldContext) {
      return changes; // First context, no changes to report
    }

    // Compare buffer context
    if (JSON.stringify(oldContext.buffer) !== JSON.stringify(newContext.buffer)) {
      changes.push({
        path: 'buffer',
        type: 'buffer',
        oldValue: oldContext.buffer,
        newValue: newContext.buffer
      });
    }

    // Compare project context
    if (JSON.stringify(oldContext.project) !== JSON.stringify(newContext.project)) {
      changes.push({
        path: 'project',
        type: 'project',
        oldValue: oldContext.project,
        newValue: newContext.project
      });
    }

    // Compare execution context
    if (JSON.stringify(oldContext.execution) !== JSON.stringify(newContext.execution)) {
      changes.push({
        path: 'execution',
        type: 'execution',
        oldValue: oldContext.execution,
        newValue: newContext.execution
      });
    }

    // Compare user context
    if (JSON.stringify(oldContext.user) !== JSON.stringify(newContext.user)) {
      changes.push({
        path: 'user',
        type: 'user',
        oldValue: oldContext.user,
        newValue: newContext.user
      });
    }

    return changes;
  }

  private createMCPError(
    code: MCPError['code'],
    message: string,
    providerId?: MCPProviderId,
    actionId?: MCPActionId
  ): MCPError {
    const error = new Error(message) as MCPError;
    error.code = code;
    error.providerId = providerId;
    error.actionId = actionId;
    error.retryable = code !== 'ROLLBACK_FAILED'; // Most errors are retryable except rollback failures
    return error;
  }
}