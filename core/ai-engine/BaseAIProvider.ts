import { AIProvider, AIContext, AICapability, ProviderId, AIError } from './types.js';

/**
 * Abstract base class for AI providers with common functionality
 */
export abstract class BaseAIProvider implements AIProvider {
  public readonly id: ProviderId;
  public readonly name: string;
  public readonly type: 'remote' | 'local';
  public readonly capabilities: AICapability[];
  public priority: number;

  protected initialized = false;
  protected destroyed = false;

  constructor(
    id: ProviderId,
    name: string,
    type: 'remote' | 'local',
    capabilities: AICapability[],
    priority = 0
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.capabilities = capabilities;
    this.priority = priority;
  }

  // Abstract methods that must be implemented by concrete providers
  abstract ask(prompt: string, context?: AIContext): Promise<string>;
  abstract complete(code: string, position?: number): Promise<string>;
  abstract isAvailable(): Promise<boolean>;

  // Optional streaming support - providers can override
  async askStream?(prompt: string, callback: (chunk: string) => void, context?: AIContext): Promise<void> {
    // Default implementation falls back to non-streaming
    const response = await this.ask(prompt, context);
    callback(response);
  }

  // Lifecycle methods with default implementations
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    await this.doInitialize();
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    await this.doDestroy();
    this.destroyed = true;
    this.initialized = false;
  }

  // Protected methods for subclasses to override
  protected async doInitialize(): Promise<void> {
    // Default: no initialization needed
  }

  protected async doDestroy(): Promise<void> {
    // Default: no cleanup needed
  }

  // Utility methods for error handling
  protected createError(
    message: string, 
    code: AIError['code'] = 'UNKNOWN', 
    retryable = false
  ): AIError {
    const error = new Error(message) as AIError;
    error.code = code;
    error.providerId = this.id;
    error.retryable = retryable;
    return error;
  }

  protected async withTimeout<T>(
    promise: Promise<T>, 
    timeoutMs: number, 
    operation = 'operation'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(this.createError(
          `${operation} timed out after ${timeoutMs}ms`,
          'TIMEOUT',
          true
        ));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Helper method to validate context
  protected validateContext(context?: AIContext): void {
    // Basic validation - subclasses can extend
    if (context?.selection && !context.currentFile) {
      throw this.createError('Selection provided without current file context');
    }
  }

  // Helper method to check if provider supports capability
  public hasCapability(capability: AICapability): boolean {
    return this.capabilities.includes(capability);
  }

  // Helper method to ensure provider is ready
  protected ensureReady(): void {
    if (this.destroyed) {
      throw this.createError('Provider has been destroyed', 'PROVIDER_UNAVAILABLE');
    }
    if (!this.initialized) {
      throw this.createError('Provider not initialized', 'PROVIDER_UNAVAILABLE');
    }
  }
}