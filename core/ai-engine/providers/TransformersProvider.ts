import { BaseAIProvider } from '../BaseAIProvider.js';
import { AIContext, AIError } from '../types.js';

/**
 * Configuration for Transformers.js provider
 */
export interface TransformersConfig {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  cacheDir?: string;
  quantized?: boolean;
  device?: 'cpu' | 'gpu' | 'auto';
}

/**
 * Transformers.js local AI provider implementation
 */
export class TransformersProvider extends BaseAIProvider {
  private config: Required<TransformersConfig>;
  private pipeline: any = null;
  private modelLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor(config: TransformersConfig = {}) {
    super(
      'transformers',
      'Transformers.js',
      'local',
      ['chat', 'completion'],
      5 // Medium priority for local provider
    );
    
    this.config = {
      model: 'Xenova/gpt2',
      maxTokens: 512,
      temperature: 0.7,
      topP: 0.9,
      cacheDir: './models',
      quantized: true,
      device: 'auto',
      ...config
    };
  }

  async ask(prompt: string, context?: AIContext): Promise<string> {
    this.ensureReady();
    this.validateContext(context);

    await this.ensureModelLoaded();

    const enhancedPrompt = this.buildPrompt(prompt, context);
    
    try {
      const result = await this.pipeline(enhancedPrompt, {
        max_new_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        do_sample: true,
        return_full_text: false
      });

      if (Array.isArray(result) && result.length > 0) {
        return result[0].generated_text || '';
      }
      
      return result.generated_text || '';
    } catch (error) {
      throw this.createError(
        `Transformers.js generation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'UNKNOWN',
        false
      );
    }
  }

  async complete(code: string, position?: number): Promise<string> {
    this.ensureReady();

    const prompt = this.buildCompletionPrompt(code, position);
    return this.ask(prompt);
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if we can import Transformers.js
      await import('@xenova/transformers');
      return true;
    } catch (error) {
      return false;
    }
  }

  protected async doInitialize(): Promise<void> {
    // Check if Transformers.js is available
    const available = await this.isAvailable();
    if (!available) {
      throw this.createError(
        'Transformers.js is not available. Please install @xenova/transformers',
        'PROVIDER_UNAVAILABLE'
      );
    }

    // Pre-load the model in the background
    this.preloadModel();
  }

  protected async doDestroy(): Promise<void> {
    this.pipeline = null;
    this.modelLoaded = false;
    this.loadingPromise = null;
  }

  // Configuration methods
  updateConfig(config: Partial<TransformersConfig>): void {
    const oldModel = this.config.model;
    this.config = { ...this.config, ...config };
    
    // If model changed, reload it
    if (config.model && config.model !== oldModel) {
      this.modelLoaded = false;
      this.pipeline = null;
      this.loadingPromise = null;
    }
  }

  getConfig(): TransformersConfig {
    return { ...this.config };
  }

  // Model management methods
  async loadModel(): Promise<void> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.doLoadModel();
    return this.loadingPromise;
  }

  isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  getModelInfo(): { model: string; loaded: boolean; loading: boolean } {
    return {
      model: this.config.model,
      loaded: this.modelLoaded,
      loading: this.loadingPromise !== null && !this.modelLoaded
    };
  }

  // Private helper methods
  private async ensureModelLoaded(): Promise<void> {
    if (!this.modelLoaded) {
      await this.loadModel();
    }
  }

  private preloadModel(): void {
    // Start loading model in background without waiting
    this.loadModel().catch(error => {
      console.warn('Failed to preload Transformers.js model:', error);
    });
  }

  private async doLoadModel(): Promise<void> {
    try {
      const { pipeline } = await import('@xenova/transformers');
      
      // Configure environment
      const { env } = await import('@xenova/transformers');
      
      if (this.config.cacheDir) {
        env.cacheDir = this.config.cacheDir;
      }
      
      // Set device preference
      if (this.config.device !== 'auto') {
        env.backends.onnx.wasm.numThreads = this.config.device === 'cpu' ? 1 : 4;
      }

      // Load the text generation pipeline
      this.pipeline = await pipeline('text-generation', this.config.model, {
        quantized: this.config.quantized,
        device: this.config.device === 'auto' ? undefined : this.config.device
      });

      this.modelLoaded = true;
      this.loadingPromise = null;
    } catch (error) {
      this.loadingPromise = null;
      throw this.createError(
        `Failed to load Transformers.js model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PROVIDER_UNAVAILABLE',
        true
      );
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

  // Utility methods for offline detection
  static async checkOfflineCapability(): Promise<boolean> {
    try {
      await import('@xenova/transformers');
      return true;
    } catch {
      return false;
    }
  }

  static getSupportedModels(): string[] {
    return [
      'Xenova/gpt2',
      'Xenova/distilgpt2',
      'Xenova/gpt2-medium',
      'Xenova/CodeBERTa-small-v1',
      'microsoft/DialoGPT-small',
      'microsoft/DialoGPT-medium'
    ];
  }

  static getRecommendedModel(task: 'chat' | 'completion' = 'chat'): string {
    switch (task) {
      case 'completion':
        return 'Xenova/CodeBERTa-small-v1';
      case 'chat':
      default:
        return 'Xenova/distilgpt2';
    }
  }
}