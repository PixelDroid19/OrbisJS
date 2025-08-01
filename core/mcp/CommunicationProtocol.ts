/**
 * Communication Protocol - Handles standardized communication with MCP providers
 * Provides message formatting, error handling, and protocol versioning
 */

import type {
  MCPProvider,
  MCPProviderId,
  MCPContext,
  MCPAction,
  ActionResult,
  ProcessedContext
} from './types.js';

export interface ProtocolMessage {
  id: string;
  type: MessageType;
  version: string;
  timestamp: Date;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export type MessageType = 
  | 'context_request'
  | 'context_response'
  | 'action_request'
  | 'action_response'
  | 'error'
  | 'ping'
  | 'pong';

export interface ContextRequest {
  context: MCPContext;
  options?: ContextProcessingOptions;
}

export interface ContextResponse {
  processed: ProcessedContext;
  processingTime: number;
}

export interface ActionRequest {
  action: MCPAction;
  context: MCPContext;
  options?: ActionExecutionOptions;
}

export interface ActionResponse {
  result: ActionResult;
  executionTime: number;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ContextProcessingOptions {
  includeMetadata?: boolean;
  maxSuggestions?: number;
  analysisDepth?: 'shallow' | 'deep';
}

export interface ActionExecutionOptions {
  dryRun?: boolean;
  validateOnly?: boolean;
  timeout?: number;
}

export interface ProtocolConfig {
  version: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class CommunicationProtocol {
  private config: ProtocolConfig;
  private messageCounter: number = 0;
  private activeRequests: Map<string, AbortController> = new Map();

  constructor(config?: Partial<ProtocolConfig>) {
    this.config = {
      version: '1.0.0',
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...config
    };
  }

  // Context processing communication
  async requestContextProcessing(
    provider: MCPProvider,
    context: MCPContext,
    options?: ContextProcessingOptions
  ): Promise<ProcessedContext> {
    const request: ContextRequest = {
      context,
      options
    };

    const message = this.createMessage('context_request', request);
    const abortController = new AbortController();
    this.activeRequests.set(message.id, abortController);
    
    try {
      const startTime = Date.now();
      const processed = await this.executeWithRetryAndTimeout(
        () => provider.processContext(context),
        this.config.retryAttempts,
        this.config.timeout,
        abortController.signal
      );
      const processingTime = Date.now() - startTime;

      const response: ContextResponse = {
        processed,
        processingTime
      };

      this.logMessage('context_response', response, provider.id);
      return processed;
    } catch (error) {
      const errorResponse = this.createErrorResponse(error, 'CONTEXT_PROCESSING_FAILED');
      this.logMessage('error', errorResponse, provider.id);
      throw error;
    } finally {
      this.activeRequests.delete(message.id);
    }
  }

  // Action execution communication
  async requestActionExecution(
    provider: MCPProvider,
    action: MCPAction,
    context: MCPContext,
    options?: ActionExecutionOptions
  ): Promise<ActionResult> {
    const request: ActionRequest = {
      action,
      context,
      options
    };

    const message = this.createMessage('action_request', request);
    const abortController = new AbortController();
    this.activeRequests.set(message.id, abortController);

    try {
      const startTime = Date.now();
      
      // Handle dry run
      if (options?.dryRun) {
        return this.performDryRun(action, context);
      }

      // Handle validation only
      if (options?.validateOnly) {
        return this.performValidation(action, context);
      }

      const result = await this.executeWithRetryAndTimeout(
        () => provider.executeAction(action, context),
        this.config.retryAttempts,
        options?.timeout || this.config.timeout,
        abortController.signal
      );

      const executionTime = Date.now() - startTime;

      const response: ActionResponse = {
        result,
        executionTime
      };

      this.logMessage('action_response', response, provider.id);
      return result;
    } catch (error) {
      const errorResponse = this.createErrorResponse(error, 'ACTION_EXECUTION_FAILED');
      this.logMessage('error', errorResponse, provider.id);
      throw error;
    } finally {
      this.activeRequests.delete(message.id);
    }
  }

  // Health check communication
  async ping(provider: MCPProvider): Promise<boolean> {
    const message = this.createMessage('ping', { timestamp: new Date() });
    
    try {
      // Simple ping - try to process minimal context
      const testContext: MCPContext = {
        id: 'ping-test',
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

      if (provider.capabilities.includes('context_processing')) {
        await this.executeWithTimeout(
          () => provider.processContext(testContext),
          5000 // 5 second timeout for ping
        );
      }

      const pongMessage = this.createMessage('pong', { timestamp: new Date() });
      this.logMessage('pong', pongMessage.payload, provider.id);
      return true;
    } catch (error) {
      const errorResponse = this.createErrorResponse(error, 'PING_FAILED');
      this.logMessage('error', errorResponse, provider.id);
      return false;
    }
  }

  // Message creation and formatting
  private createMessage(_type: MessageType, payload: unknown): ProtocolMessage {
    return {
      id: this.generateMessageId(),
      type: _type,
      version: this.config.version,
      timestamp: new Date(),
      payload,
      metadata: {
        source: 'mcp-client',
        protocol: 'mcp-v1'
      }
    };
  }

  private createErrorResponse(error: unknown, _code: string): ErrorResponse {
    return {
      code: _code,
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        timestamp: new Date(),
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageCounter}`;
  }

  // Request cancellation
  cancelRequest(messageId: string): boolean {
    const controller = this.activeRequests.get(messageId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(messageId);
      return true;
    }
    return false;
  }

  cancelAllRequests(): void {
    for (const [messageId, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  // Execution utilities
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxAttempts) {
          // Wait before retrying
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeWithRetryAndTimeout<T>(
    operation: () => Promise<T>,
    maxAttempts: number,
    timeoutMs: number,
    abortSignal?: AbortSignal
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check if request was cancelled
      if (abortSignal?.aborted) {
        throw new Error('Request was cancelled');
      }

      try {
        return await this.executeWithTimeout(operation, timeoutMs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry if request was cancelled or timed out
        if (abortSignal?.aborted || (error instanceof Error && error.message.includes('timed out'))) {
          throw error;
        }
        
        if (attempt < maxAttempts) {
          // Wait before retrying
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Dry run and validation
  private async performDryRun(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    // Simulate action execution without making changes
    return {
      success: true,
      metadata: {
        dryRun: true,
        actionType: action.type,
        targetType: action.target.type,
        wouldExecute: true,
        estimatedChanges: this.estimateChanges(action, context)
      }
    };
  }

  private async performValidation(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    // Validate action without executing
    const errors: string[] = [];

    // Basic validation
    if (!action.id) {
      errors.push('Action ID is required');
    }

    if (!action.type) {
      errors.push('Action type is required');
    }

    if (!action.target) {
      errors.push('Action target is required');
    }

    // Target-specific validation
    if (action.target) {
      switch (action.target.type) {
        case 'selection':
          if (!action.target.range) {
            errors.push('Selection target requires range');
          }
          break;
        case 'file':
          if (!action.target.path) {
            errors.push('File target requires path');
          }
          break;
        case 'function':
        case 'class':
          if (!action.target.identifier) {
            errors.push(`${action.target.type} target requires identifier`);
          }
          break;
      }
    }

    return {
      success: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      metadata: {
        validationOnly: true,
        errors,
        actionType: action.type,
        targetType: action.target?.type
      }
    };
  }

  private estimateChanges(action: MCPAction, context: MCPContext): number {
    // Simple estimation based on action type and context
    switch (action.type) {
      case 'refactor':
      case 'optimize':
        return Math.floor(context.buffer.content.length * 0.3); // Estimate 30% change
      case 'format':
        return Math.floor(context.buffer.content.length * 0.1); // Estimate 10% change
      case 'document':
        return 200; // Estimate 200 characters of documentation
      case 'rename':
        return 50; // Estimate 50 characters changed
      default:
        return 100; // Default estimate
    }
  }

  // Logging
  private logMessage(_type: MessageType, payload: unknown, providerId: MCPProviderId): void {
    // In a real implementation, this would use a proper logging system
    console.debug(`[MCP Protocol] ${_type} - Provider: ${providerId}`, {
      type: _type,
      providerId,
      timestamp: new Date(),
      payload: typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload
    });
  }

  // Configuration
  updateConfig(config: Partial<ProtocolConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ProtocolConfig {
    return { ...this.config };
  }
}