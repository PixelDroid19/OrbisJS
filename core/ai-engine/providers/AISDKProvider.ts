import { BaseAIProvider } from '../BaseAIProvider.js';
import { AIContext, AIError } from '../types.js';

/**
 * Configuration for AI SDK provider
 */
export interface AISDKConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'mistral';
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * AI SDK provider implementation using Vercel AI SDK
 */
export class AISDKProvider extends BaseAIProvider {
  private config: Required<AISDKConfig>;
  private aiInstance: any = null;

  constructor(config: AISDKConfig) {
    super(
      `aisdk-${config.provider}`,
      `AI SDK (${config.provider})`,
      'remote',
      ['chat', 'completion', 'streaming'],
      8 // High priority for standardized AI operations
    );
    
    this.config = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: this.getDefaultModel(config.provider),
      baseUrl: '',
      maxTokens: 2048,
      temperature: 0.7,
      topP: 1.0,
      frequencyPenalty: 0,
      presencePenalty: 0,
      ...config
    };
  }

  async ask(prompt: string, context?: AIContext): Promise<string> {
    this.ensureReady();
    this.validateContext(context);

    await this.ensureAIInstance();

    const messages = this.buildMessages(prompt, context);
    
    try {
      const { generateText } = await import('ai');
      
      const result = await generateText({
        model: this.aiInstance,
        messages,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        topP: this.config.topP,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty
      });

      return result.text;
    } catch (error) {
      throw this.createError(
        `AI SDK generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        true
      );
    }
  }

  async complete(code: string, position?: number): Promise<string> {
    this.ensureReady();

    const prompt = this.buildCompletionPrompt(code, position);
    return this.ask(prompt);
  }

  async askStream(prompt: string, callback: (chunk: string) => void, context?: AIContext): Promise<void> {
    this.ensureReady();
    this.validateContext(context);

    await this.ensureAIInstance();

    const messages = this.buildMessages(prompt, context);
    
    try {
      const { streamText } = await import('ai');
      
      const result = await streamText({
        model: this.aiInstance,
        messages,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        topP: this.config.topP,
        frequencyPenalty: this.config.frequencyPenalty,
        presencePenalty: this.config.presencePenalty
      });

      for await (const delta of result.textStream) {
        callback(delta);
      }
    } catch (error) {
      throw this.createError(
        `AI SDK streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        true
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if AI SDK is available
      await import('ai');
      
      // Check if the specific provider is available
      await this.getProviderModule();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async doInitialize(): Promise<void> {
    // Validate API key
    if (!this.config.apiKey) {
      throw this.createError(`${this.config.provider} API key is required`, 'PROVIDER_UNAVAILABLE');
    }

    // Check if AI SDK and provider are available
    const available = await this.isAvailable();
    if (!available) {
      throw this.createError(
        `AI SDK or ${this.config.provider} provider is not available`,
        'PROVIDER_UNAVAILABLE'
      );
    }

    // Initialize AI instance
    await this.ensureAIInstance();
  }

  protected async doDestroy(): Promise<void> {
    this.aiInstance = null;
  }

  // Configuration methods
  updateConfig(config: Partial<AISDKConfig>): void {
    const oldProvider = this.config.provider;
    this.config = { ...this.config, ...config };
    
    // If provider changed, reset AI instance
    if (config.provider && config.provider !== oldProvider) {
      this.aiInstance = null;
    }
  }

  getConfig(): AISDKConfig {
    return { ...this.config };
  }

  // Private helper methods
  private async ensureAIInstance(): Promise<void> {
    if (this.aiInstance) {
      return;
    }

    try {
      const providerModule = await this.getProviderModule();
      this.aiInstance = this.createProviderInstance(providerModule);
    } catch (error) {
      throw this.createError(
        `Failed to initialize ${this.config.provider} provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_UNAVAILABLE',
        true
      );
    }
  }

  private async getProviderModule(): Promise<any> {
    switch (this.config.provider) {
      case 'openai':
        return import('@ai-sdk/openai');
      case 'anthropic':
        return import('@ai-sdk/anthropic');
      case 'google':
        return import('@ai-sdk/google');
      case 'cohere':
        return import('@ai-sdk/cohere');
      case 'mistral':
        return import('@ai-sdk/mistral');
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private createProviderInstance(providerModule: any): any {
    const config: any = {
      apiKey: this.config.apiKey
    };

    if (this.config.baseUrl) {
      config.baseURL = this.config.baseUrl;
    }

    switch (this.config.provider) {
      case 'openai':
        return providerModule.openai(config);
      case 'anthropic':
        return providerModule.anthropic(config);
      case 'google':
        return providerModule.google(config);
      case 'cohere':
        return providerModule.cohere(config);
      case 'mistral':
        return providerModule.mistral(config);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'google':
        return 'gemini-pro';
      case 'cohere':
        return 'command';
      case 'mistral':
        return 'mistral-small';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  private buildMessages(prompt: string, context?: AIContext): any[] {
    const messages: any[] = [];

    // Add system message with context
    if (context) {
      const systemPrompt = this.buildSystemPrompt(context);
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
    }

    // Add user message
    messages.push({ role: 'user', content: prompt });

    return messages;
  }

  private buildSystemPrompt(context: AIContext): string {
    const parts: string[] = [];

    if (context.language) {
      parts.push(`You are helping with ${context.language} code.`);
    }

    if (context.currentFile) {
      parts.push(`Current file: ${context.currentFile}`);
    }

    if (context.selection) {
      parts.push(`Selected code:\n\`\`\`${context.language || 'javascript'}\n${context.selection}\n\`\`\``);
    }

    if (context.projectStructure) {
      parts.push('Project structure available for reference.');
    }

    return parts.join('\n\n');
  }

  private buildCompletionPrompt(code: string, position?: number): string {
    const language = 'javascript'; // Default, could be enhanced with language detection
    
    let prompt = `Complete the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``;
    
    if (position !== undefined) {
      prompt += `\n\nCursor position: ${position}`;
    }
    
    prompt += '\n\nProvide only the completion, no explanations.';
    
    return prompt;
  }

  // Static utility methods
  static getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'google', 'cohere', 'mistral'];
  }

  static getDefaultModelForProvider(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'gpt-3.5-turbo';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      case 'google':
        return 'gemini-pro';
      case 'cohere':
        return 'command';
      case 'mistral':
        return 'mistral-small';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  static async checkProviderAvailability(provider: string): Promise<boolean> {
    try {
      await import('ai');
      
      switch (provider) {
        case 'openai':
          await import('@ai-sdk/openai');
          break;
        case 'anthropic':
          await import('@ai-sdk/anthropic');
          break;
        case 'google':
          await import('@ai-sdk/google');
          break;
        case 'cohere':
          await import('@ai-sdk/cohere');
          break;
        case 'mistral':
          await import('@ai-sdk/mistral');
          break;
        default:
          return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
}