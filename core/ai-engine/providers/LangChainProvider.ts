import { BaseAIProvider } from '../BaseAIProvider.js';
import { AIContext, AIError, ConversationMessage } from '../types.js';

/**
 * Configuration for LangChain provider
 */
export interface LangChainConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'cohere' | 'ollama';
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  enableMemory?: boolean;
  memoryType?: 'buffer' | 'summary' | 'token';
  maxMemoryTokens?: number;
}

/**
 * LangChain provider implementation with conversation management and agents
 */
export class LangChainProvider extends BaseAIProvider {
  private config: Required<LangChainConfig>;
  private llm: any = null;
  private memory: any = null;
  private chain: any = null;
  private conversations = new Map<string, any>();

  constructor(config: LangChainConfig) {
    super(
      `langchain-${config.provider}`,
      `LangChain (${config.provider})`,
      'remote',
      ['chat', 'completion', 'streaming'],
      7 // High priority for complex AI workflows
    );
    
    this.config = {
      provider: config.provider,
      apiKey: config.apiKey || '',
      model: this.getDefaultModel(config.provider),
      baseUrl: '',
      maxTokens: 2048,
      temperature: 0.7,
      topP: 1.0,
      enableMemory: true,
      memoryType: 'buffer',
      maxMemoryTokens: 4000,
      ...config
    };
  }

  async ask(prompt: string, context?: AIContext): Promise<string> {
    this.ensureReady();
    this.validateContext(context);

    await this.ensureLLMInstance();

    const enhancedPrompt = this.buildPrompt(prompt, context);
    
    try {
      if (this.config.enableMemory && this.chain) {
        const result = await this.chain.call({ input: enhancedPrompt });
        return result.response || result.text || '';
      } else {
        const result = await this.llm.call(enhancedPrompt);
        return result;
      }
    } catch (error) {
      throw this.createError(
        `LangChain generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

    await this.ensureLLMInstance();

    const enhancedPrompt = this.buildPrompt(prompt, context);
    
    try {
      // LangChain streaming implementation
      const stream = await this.llm.stream(enhancedPrompt);
      
      for await (const chunk of stream) {
        callback(chunk);
      }
    } catch (error) {
      // Fallback to non-streaming if streaming is not supported
      const response = await this.ask(prompt, context);
      callback(response);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if LangChain is available
      await import('langchain/llms/base');
      
      // Check if the specific provider is available
      await this.getProviderModule();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async doInitialize(): Promise<void> {
    // Validate API key for providers that need it
    if (this.config.provider !== 'ollama' && !this.config.apiKey) {
      throw this.createError(`${this.config.provider} API key is required`, 'PROVIDER_UNAVAILABLE');
    }

    // Check if LangChain and provider are available
    const available = await this.isAvailable();
    if (!available) {
      throw this.createError(
        `LangChain or ${this.config.provider} provider is not available`,
        'PROVIDER_UNAVAILABLE'
      );
    }

    // Initialize LLM instance
    await this.ensureLLMInstance();
  }

  protected async doDestroy(): Promise<void> {
    this.llm = null;
    this.memory = null;
    this.chain = null;
    this.conversations.clear();
  }

  // Configuration methods
  updateConfig(config: Partial<LangChainConfig>): void {
    const oldProvider = this.config.provider;
    this.config = { ...this.config, ...config };
    
    // If provider changed, reset instances
    if (config.provider && config.provider !== oldProvider) {
      this.llm = null;
      this.memory = null;
      this.chain = null;
    }
  }

  getConfig(): LangChainConfig {
    return { ...this.config };
  }

  // Conversation management methods
  async createConversation(id: string, systemPrompt?: string): Promise<void> {
    await this.ensureLLMInstance();

    try {
      const { ConversationChain } = await import('langchain/chains');
      const memory = await this.createMemory();
      
      const chain = new ConversationChain({
        llm: this.llm,
        memory: memory
      });

      if (systemPrompt) {
        // Add system message to memory
        await memory.chatHistory.addSystemMessage(systemPrompt);
      }

      this.conversations.set(id, { chain, memory });
    } catch (error) {
      throw this.createError(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        false
      );
    }
  }

  async continueConversation(id: string, message: string): Promise<string> {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      throw this.createError(`Conversation ${id} not found`, 'UNKNOWN', false);
    }

    try {
      const result = await conversation.chain.call({ input: message });
      return result.response || result.text || '';
    } catch (error) {
      throw this.createError(
        `Conversation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        true
      );
    }
  }

  async endConversation(id: string): Promise<void> {
    this.conversations.delete(id);
  }

  getConversationHistory(id: string): ConversationMessage[] {
    const conversation = this.conversations.get(id);
    if (!conversation) {
      return [];
    }

    // Extract messages from LangChain memory
    try {
      const messages = conversation.memory.chatHistory.messages || [];
      return messages.map((msg: any, index: number) => ({
        id: `msg_${index}`,
        role: msg.type === 'human' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date()
      }));
    } catch {
      return [];
    }
  }

  // Agent creation methods
  async createAgent(tools: string[] = [], agentType: 'zero-shot' | 'conversational' = 'zero-shot'): Promise<any> {
    await this.ensureLLMInstance();

    try {
      const { initializeAgentExecutorWithOptions } = await import('langchain/agents');
      const { DynamicTool } = await import('langchain/tools');
      
      // Create tools based on the provided tool names
      const langchainTools = await this.createTools(tools);
      
      const agent = await initializeAgentExecutorWithOptions(
        langchainTools,
        this.llm,
        {
          agentType: agentType === 'zero-shot' ? 'zero-shot-react-description' : 'conversational-react-description',
          verbose: false,
          maxIterations: 3
        }
      );

      return agent;
    } catch (error) {
      throw this.createError(
        `Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        false
      );
    }
  }

  // Private helper methods
  private async ensureLLMInstance(): Promise<void> {
    if (this.llm) {
      return;
    }

    try {
      const providerModule = await this.getProviderModule();
      this.llm = this.createLLMInstance(providerModule);
      
      if (this.config.enableMemory) {
        this.memory = await this.createMemory();
        this.chain = await this.createChain();
      }
    } catch (error) {
      throw this.createError(
        `Failed to initialize ${this.config.provider} LLM: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_UNAVAILABLE',
        true
      );
    }
  }

  private async getProviderModule(): Promise<any> {
    switch (this.config.provider) {
      case 'openai':
        return import('langchain/llms/openai');
      case 'anthropic':
        return import('langchain/llms/anthropic');
      case 'google':
        return import('langchain/llms/googleai');
      case 'cohere':
        return import('langchain/llms/cohere');
      case 'ollama':
        return import('langchain/llms/ollama');
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private createLLMInstance(providerModule: any): any {
    const config: any = {
      modelName: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
      topP: this.config.topP
    };

    if (this.config.apiKey) {
      config.openAIApiKey = this.config.apiKey; // Most providers use this key name
    }

    if (this.config.baseUrl) {
      config.configuration = { baseURL: this.config.baseUrl };
    }

    switch (this.config.provider) {
      case 'openai':
        return new providerModule.OpenAI(config);
      case 'anthropic':
        return new providerModule.Anthropic({ ...config, anthropicApiKey: this.config.apiKey });
      case 'google':
        return new providerModule.GoogleAI({ ...config, apiKey: this.config.apiKey });
      case 'cohere':
        return new providerModule.Cohere({ ...config, apiKey: this.config.apiKey });
      case 'ollama':
        return new providerModule.Ollama({ ...config, baseUrl: this.config.baseUrl || 'http://localhost:11434' });
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async createMemory(): Promise<any> {
    switch (this.config.memoryType) {
      case 'buffer':
        const { BufferMemory } = await import('langchain/memory');
        return new BufferMemory({
          returnMessages: true,
          memoryKey: 'history'
        });
      
      case 'summary':
        const { ConversationSummaryMemory } = await import('langchain/memory');
        return new ConversationSummaryMemory({
          llm: this.llm,
          returnMessages: true,
          memoryKey: 'history'
        });
      
      case 'token':
        const { ConversationTokenBufferMemory } = await import('langchain/memory');
        return new ConversationTokenBufferMemory({
          llm: this.llm,
          maxTokenLimit: this.config.maxMemoryTokens,
          returnMessages: true,
          memoryKey: 'history'
        });
      
      default:
        const { BufferMemory: DefaultBufferMemory } = await import('langchain/memory');
        return new DefaultBufferMemory({
          returnMessages: true,
          memoryKey: 'history'
        });
    }
  }

  private async createChain(): Promise<any> {
    const { ConversationChain } = await import('langchain/chains');
    
    return new ConversationChain({
      llm: this.llm,
      memory: this.memory
    });
  }

  private async createTools(toolNames: string[]): Promise<any[]> {
    const { DynamicTool } = await import('langchain/tools');
    const tools: any[] = [];

    for (const toolName of toolNames) {
      switch (toolName) {
        case 'calculator':
          tools.push(new DynamicTool({
            name: 'calculator',
            description: 'Useful for mathematical calculations',
            func: async (input: string) => {
              try {
                // Simple calculator implementation
                const result = eval(input.replace(/[^0-9+\-*/().\s]/g, ''));
                return String(result);
              } catch {
                return 'Invalid calculation';
              }
            }
          }));
          break;
        
        case 'code-executor':
          tools.push(new DynamicTool({
            name: 'code-executor',
            description: 'Execute JavaScript code safely',
            func: async (input: string) => {
              // This would integrate with the WebContainer runner
              return 'Code execution not implemented in this context';
            }
          }));
          break;
        
        default:
          // Create a generic tool
          tools.push(new DynamicTool({
            name: toolName,
            description: `Tool for ${toolName}`,
            func: async (input: string) => `${toolName} tool called with: ${input}`
          }));
      }
    }

    return tools;
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
      case 'ollama':
        return 'llama2';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  private buildPrompt(prompt: string, context?: AIContext): string {
    const parts: string[] = [];

    // Add context information
    if (context) {
      if (context.language) {
        parts.push(`Language: ${context.language}`);
      }

      if (context.currentFile) {
        parts.push(`File: ${context.currentFile}`);
      }

      if (context.selection) {
        parts.push(`Code context:\n${context.selection}`);
      }
    }

    // Add the main prompt
    parts.push(prompt);

    return parts.join('\n\n');
  }

  private buildCompletionPrompt(code: string, position?: number): string {
    let prompt = `Complete the following code:\n\n${code}`;
    
    if (position !== undefined) {
      prompt += `\n\nCursor at position: ${position}`;
    }
    
    prompt += '\n\nCompletion:';
    
    return prompt;
  }

  // Static utility methods
  static getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'google', 'cohere', 'ollama'];
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
      case 'ollama':
        return 'llama2';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  static async checkProviderAvailability(provider: string): Promise<boolean> {
    try {
      await import('langchain/llms/base');
      
      switch (provider) {
        case 'openai':
          await import('langchain/llms/openai');
          break;
        case 'anthropic':
          await import('langchain/llms/anthropic');
          break;
        case 'google':
          await import('langchain/llms/googleai');
          break;
        case 'cohere':
          await import('langchain/llms/cohere');
          break;
        case 'ollama':
          await import('langchain/llms/ollama');
          break;
        default:
          return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  static getSupportedTools(): string[] {
    return ['calculator', 'code-executor'];
  }

  static getSupportedAgentTypes(): string[] {
    return ['zero-shot', 'conversational'];
  }

  static getSupportedMemoryTypes(): string[] {
    return ['buffer', 'summary', 'token'];
  }
}