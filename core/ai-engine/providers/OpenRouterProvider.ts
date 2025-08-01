import { BaseAIProvider } from '../BaseAIProvider.js';
import { AIContext, AIError } from '../types.js';

/**
 * Configuration for OpenRouter provider
 */
export interface OpenRouterConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * OpenRouter API request/response types
 */
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
}

interface OpenRouterChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * OpenRouter AI provider implementation
 */
export class OpenRouterProvider extends BaseAIProvider {
  private config: OpenRouterConfig;
  private rateLimitReset: number = 0;
  private requestCount: number = 0;
  private readonly maxRequestsPerMinute = 60; // Conservative default

  constructor(config: OpenRouterConfig) {
    super(
      'openrouter',
      'OpenRouter',
      'remote',
      ['chat', 'completion', 'streaming'],
      10 // High priority for remote provider
    );
    
    this.config = {
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-3.5-turbo',
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

    const messages = this.buildMessages(prompt, context);
    const response = await this.makeRequest(messages);
    
    return response.choices[0]?.message?.content || '';
  }

  async complete(code: string, position?: number): Promise<string> {
    this.ensureReady();

    const prompt = this.buildCompletionPrompt(code, position);
    return this.ask(prompt);
  }

  async askStream(prompt: string, callback: (chunk: string) => void, context?: AIContext): Promise<void> {
    this.ensureReady();
    this.validateContext(context);

    const messages = this.buildMessages(prompt, context);
    await this.makeStreamRequest(messages, callback);
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to make a minimal request
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://runjs-local-ai.app',
          'X-Title': 'RunJS Local + AI'
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  protected async doInitialize(): Promise<void> {
    // Validate API key
    if (!this.config.apiKey) {
      throw this.createError('OpenRouter API key is required', 'PROVIDER_UNAVAILABLE');
    }

    // Test connection
    const available = await this.isAvailable();
    if (!available) {
      throw this.createError('Unable to connect to OpenRouter API', 'PROVIDER_UNAVAILABLE');
    }
  }

  // Configuration methods
  updateConfig(config: Partial<OpenRouterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): OpenRouterConfig {
    return { ...this.config };
  }

  // Private helper methods
  private buildMessages(prompt: string, context?: AIContext): OpenRouterMessage[] {
    const messages: OpenRouterMessage[] = [];

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

  private async makeRequest(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    await this.checkRateLimit();

    const request: OpenRouterRequest = {
      model: this.config.model!,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      frequency_penalty: this.config.frequencyPenalty,
      presence_penalty: this.config.presencePenalty
    };

    try {
      const response = await this.withTimeout(
        fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': 'https://runjs-local-ai.app',
            'X-Title': 'RunJS Local + AI'
          },
          body: JSON.stringify(request)
        }),
        30000,
        'OpenRouter API request'
      );

      await this.handleRateLimit(response);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data: OpenRouterResponse = await response.json();
      this.requestCount++;

      return data;
    } catch (error) {
      // If it's already an AIError from handleErrorResponse, re-throw it
      if (error && typeof error === 'object' && 'code' in error && 'providerId' in error) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw this.createError(
          `OpenRouter API error: ${error.message}`,
          'UNKNOWN',
          true
        );
      }
      throw error;
    }
  }

  private async makeStreamRequest(
    messages: OpenRouterMessage[], 
    callback: (chunk: string) => void
  ): Promise<void> {
    await this.checkRateLimit();

    const request: OpenRouterRequest = {
      model: this.config.model!,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      frequency_penalty: this.config.frequencyPenalty,
      presence_penalty: this.config.presencePenalty,
      stream: true
    };

    try {
      const response = await this.withTimeout(
        fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            'HTTP-Referer': 'https://runjs-local-ai.app',
            'X-Title': 'RunJS Local + AI'
          },
          body: JSON.stringify(request)
        }),
        30000,
        'OpenRouter streaming request'
      );

      await this.handleRateLimit(response);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw this.createError('No response body for streaming request', 'INVALID_RESPONSE');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed: OpenRouterStreamChunk = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content;
                
                if (content) {
                  callback(content);
                }
              } catch (parseError) {
                // Skip invalid JSON chunks
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      this.requestCount++;
    } catch (error) {
      // If it's already an AIError from handleErrorResponse, re-throw it
      if (error && typeof error === 'object' && 'code' in error && 'providerId' in error) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw this.createError(
          `OpenRouter streaming error: ${error.message}`,
          'UNKNOWN',
          true
        );
      }
      throw error;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counter every minute
    if (now > this.rateLimitReset) {
      this.requestCount = 0;
      this.rateLimitReset = now + 60000; // 1 minute
    }

    // Wait if we've exceeded rate limit
    if (this.requestCount >= this.maxRequestsPerMinute) {
      const waitTime = this.rateLimitReset - now;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.rateLimitReset = Date.now() + 60000;
      }
    }
  }

  private async handleRateLimit(response: Response): Promise<void> {
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');

    if (remaining && parseInt(remaining) === 0 && reset) {
      const resetTime = parseInt(reset) * 1000;
      const waitTime = resetTime - Date.now();
      
      if (waitTime > 0) {
        throw this.createError(
          `Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)} seconds`,
          'QUOTA_EXCEEDED',
          true
        );
      }
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorCode: AIError['code'] = 'UNKNOWN';
    let retryable = false;

    try {
      const errorData = await response.json();
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch {
      // Use default error message if JSON parsing fails
    }

    // Map HTTP status codes to error types
    switch (response.status) {
      case 401:
        errorCode = 'PROVIDER_UNAVAILABLE';
        errorMessage = 'Invalid API key';
        break;
      case 429:
        errorCode = 'QUOTA_EXCEEDED';
        retryable = true;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorCode = 'PROVIDER_UNAVAILABLE';
        retryable = true;
        break;
      default:
        errorCode = 'UNKNOWN';
        retryable = response.status >= 500;
    }

    throw this.createError(errorMessage, errorCode, retryable);
  }
}