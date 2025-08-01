import { 
  AIEngine, 
  AIProvider, 
  AIContext, 
  ConversationId, 
  ProviderId, 
  Conversation,
  ConversationMessage,
  AIEngineConfig,
  AIError,
  AICapability
} from './types.js';
import { BaseAIProvider } from './BaseAIProvider.js';

/**
 * Core AI Engine implementation with multi-provider support and fallback logic
 */
export class AIEngineImpl implements AIEngine {
  private providers = new Map<ProviderId, AIProvider>();
  private conversations = new Map<ConversationId, Conversation>();
  private config: AIEngineConfig = {
    fallbackEnabled: true,
    maxRetries: 3,
    timeoutMs: 30000
  };

  private initialized = false;
  private conversationCounter = 0;

  // Provider management
  addProvider(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with id '${provider.id}' already exists`);
    }
    
    this.providers.set(provider.id, provider);
    
    // Initialize provider if engine is already initialized
    if (this.initialized) {
      provider.initialize?.();
    }
  }

  removeProvider(providerId: ProviderId): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.destroy?.();
      this.providers.delete(providerId);
    }
  }

  setProviderPriority(providerId: ProviderId, priority: number): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      (provider as BaseAIProvider & { priority: number }).priority = priority;
    }
  }

  getProvider(providerId: ProviderId): AIProvider | null {
    return this.providers.get(providerId) || null;
  }

  listProviders(): AIProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => b.priority - a.priority);
  }

  // Core AI operations with fallback logic
  async ask(prompt: string, context?: AIContext, providerId?: ProviderId): Promise<string> {
    const providers = this.getProvidersForCapability('chat', providerId);
    return this.executeWithFallback(providers, async (provider) => {
      return provider.ask(prompt, context);
    });
  }

  async completeCode(code: string, position?: number, context?: AIContext): Promise<string> {
    const providers = this.getProvidersForCapability('completion');
    return this.executeWithFallback(providers, async (provider) => {
      return provider.complete(code, position);
    });
  }

  async explainCode(code: string, context?: AIContext): Promise<string> {
    const enhancedContext = { ...context, selection: code };
    const prompt = `Please explain the following code:\n\n\`\`\`${context?.language || 'javascript'}\n${code}\n\`\`\``;
    
    return this.ask(prompt, enhancedContext);
  }

  async generateFunction(description: string, context?: AIContext): Promise<string> {
    const language = context?.language || 'javascript';
    let prompt = `Generate a ${language} function based on this description: ${description}`;
    
    if (context?.currentFile) {
      prompt += `\n\nContext: This will be used in ${context.currentFile}`;
    }
    
    return this.ask(prompt, context);
  }

  async refactorCode(code: string, instruction: string, context?: AIContext): Promise<string> {
    const enhancedContext = { ...context, selection: code };
    const prompt = `Refactor the following code according to this instruction: ${instruction}\n\n\`\`\`${context?.language || 'javascript'}\n${code}\n\`\`\``;
    
    return this.ask(prompt, enhancedContext);
  }

  // Conversation management
  startConversation(providerId?: ProviderId): ConversationId {
    const id = `conv_${++this.conversationCounter}_${Date.now()}`;
    const provider = providerId ? this.getProvider(providerId) : this.getDefaultProvider();
    
    if (!provider) {
      throw new Error('No available provider for conversation');
    }

    const conversation: Conversation = {
      id,
      title: 'New Conversation',
      messages: [],
      context: {},
      provider: provider.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.set(id, conversation);
    return id;
  }

  async continueConversation(id: ConversationId, message: string, context?: AIContext): Promise<string> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw new Error(`Conversation ${id} not found`);
    }

    // Update context
    if (context) {
      conversation.context = { ...conversation.context, ...context };
    }

    // Get AI response
    const provider = this.getProvider(conversation.provider);
    if (!provider) {
      throw new Error(`Provider ${conversation.provider} not available`);
    }

    const conversationPrompt = this.buildConversationPrompt(conversation, message);
    const response = await provider.ask(conversationPrompt, conversation.context);

    // Add user message
    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    conversation.messages.push(userMessage);

    // Add assistant message
    const assistantMessage: ConversationMessage = {
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: response,
      timestamp: new Date()
    };
    conversation.messages.push(assistantMessage);

    // Update conversation metadata
    conversation.updatedAt = new Date();
    if (conversation.title === 'New Conversation' && conversation.messages.length === 2) {
      conversation.title = this.generateConversationTitle(message);
    }

    return response;
  }

  endConversation(id: ConversationId): void {
    this.conversations.delete(id);
  }

  getConversation(id: ConversationId): Conversation | null {
    return this.conversations.get(id) || null;
  }

  listConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // Streaming support
  async askStream(
    prompt: string, 
    callback: (chunk: string) => void, 
    context?: AIContext, 
    providerId?: ProviderId
  ): Promise<void> {
    const providers = this.getProvidersForCapability('streaming', providerId);
    
    for (const provider of providers) {
      try {
        if (provider.askStream) {
          await provider.askStream(prompt, callback, context);
          return;
        }
      } catch (error) {
        if (!this.config.fallbackEnabled || providers.indexOf(provider) === providers.length - 1) {
          throw error;
        }
        // Continue to next provider
      }
    }

    // Fallback to non-streaming
    const response = await this.ask(prompt, context, providerId);
    callback(response);
  }

  // Configuration
  configure(config: Partial<AIEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): AIEngineConfig {
    return { ...this.config };
  }

  // Lifecycle
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize all providers
    const initPromises = Array.from(this.providers.values()).map(provider => 
      provider.initialize?.() || Promise.resolve()
    );

    await Promise.allSettled(initPromises);
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Destroy all providers
    const destroyPromises = Array.from(this.providers.values()).map(provider =>
      provider.destroy?.() || Promise.resolve()
    );

    await Promise.allSettled(destroyPromises);
    
    this.providers.clear();
    this.conversations.clear();
    this.initialized = false;
  }

  // Private helper methods
  private getProvidersForCapability(capability: AICapability, preferredProviderId?: ProviderId): AIProvider[] {
    let providers = Array.from(this.providers.values())
      .filter(provider => provider.capabilities.includes(capability))
      .sort((a, b) => b.priority - a.priority);

    // If a specific provider is requested, try it first
    if (preferredProviderId) {
      const preferredProvider = this.getProvider(preferredProviderId);
      if (preferredProvider && preferredProvider.capabilities.includes(capability)) {
        providers = [preferredProvider, ...providers.filter(p => p.id !== preferredProviderId)];
      }
    }

    return providers;
  }

  private getDefaultProvider(): AIProvider | null {
    if (this.config.defaultProvider) {
      return this.getProvider(this.config.defaultProvider);
    }
    
    const providers = this.listProviders();
    return providers.length > 0 ? providers[0] : null;
  }

  private async executeWithFallback<T>(
    providers: AIProvider[], 
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    if (providers.length === 0) {
      throw new Error('No available providers for this operation');
    }

    let lastError: Error | null = null;
    let retryCount = 0;

    for (const provider of providers) {
      try {
        // Check if provider is available
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
          continue;
        }

        // Execute operation with timeout
        return await this.withTimeout(
          operation(provider),
          this.config.timeoutMs,
          `${provider.name} operation`
        );

      } catch (error) {
        lastError = error as Error;
        
        // If error is retryable and we haven't exceeded max retries, try again with same provider
        if ((error as AIError).retryable && retryCount < this.config.maxRetries) {
          retryCount++;
          continue;
        }

        // If fallback is disabled or this is the last provider, throw error
        if (!this.config.fallbackEnabled || providers.indexOf(provider) === providers.length - 1) {
          throw error;
        }

        // Reset retry count for next provider
        retryCount = 0;
      }
    }

    throw lastError || new Error('All providers failed');
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private buildConversationPrompt(conversation: Conversation, newMessage: string): string {
    const messages = conversation.messages.slice(-10); // Keep last 10 messages for context
    let prompt = '';

    for (const message of messages) {
      prompt += `${message.role}: ${message.content}\n`;
    }

    prompt += `user: ${newMessage}`;
    return prompt;
  }

  private generateConversationTitle(firstMessage: string): string {
    // Simple title generation - take first few words
    const words = firstMessage.split(' ').slice(0, 5);
    return words.join(' ') + (firstMessage.split(' ').length > 5 ? '...' : '');
  }
}