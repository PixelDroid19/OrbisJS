/**
 * AI Engine - Multi-provider AI integration with fallback support
 * 
 * This module provides a unified interface for interacting with multiple AI providers,
 * including automatic fallback, load balancing, and conversation management.
 */

// Core types and interfaces
export type {
  AIEngine,
  AIProvider,
  AIContext,
  AICapability,
  AIError,
  ConversationId,
  ProviderId,
  Conversation,
  ConversationMessage,
  AIEngineConfig,
  ProviderConfig,
  CompletionItem,
  Position,
  Selection,
  FileTree,
  ExecutionResult
} from './types.js';

// Core implementations
export { AIEngineImpl } from './AIEngine.js';
export { BaseAIProvider } from './BaseAIProvider.js';

// Providers
export * from './providers/index.js';

// Factory function for creating AI Engine instance
import { AIEngineImpl } from './AIEngine.js';
import { AIEngineConfig } from './types.js';

/**
 * Create a new AI Engine instance with optional configuration
 */
export function createAIEngine(config?: Partial<AIEngineConfig>): AIEngineImpl {
  const engine = new AIEngineImpl();
  
  if (config) {
    engine.configure(config);
  }
  
  return engine;
}

/**
 * Default AI Engine instance (singleton)
 */
let defaultInstance: AIEngineImpl | null = null;

/**
 * Get the default AI Engine instance
 */
export function getDefaultAIEngine(): AIEngineImpl {
  if (!defaultInstance) {
    defaultInstance = createAIEngine();
  }
  return defaultInstance;
}

/**
 * Reset the default AI Engine instance (useful for testing)
 */
export function resetDefaultAIEngine(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}