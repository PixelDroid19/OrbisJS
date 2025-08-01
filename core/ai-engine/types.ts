/**
 * Core types and interfaces for the AI Engine
 */

export type ConversationId = string;
export type ProviderId = string;

export interface Position {
  line: number;
  column: number;
}

export interface Selection {
  start: Position;
  end: Position;
}

export interface FileTree {
  [path: string]: {
    type: 'file' | 'directory';
    content?: string;
    children?: FileTree;
  };
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface AIContext {
  currentFile?: string;
  selection?: string;
  projectStructure?: FileTree;
  executionHistory?: ExecutionResult[];
  language?: string;
  cursorPosition?: Position;
}

export interface CompletionItem {
  text: string;
  insertText: string;
  kind: 'function' | 'variable' | 'class' | 'method' | 'property' | 'keyword';
  documentation?: string;
}

export type AICapability = 
  | 'completion' 
  | 'chat' 
  | 'explanation' 
  | 'generation' 
  | 'refactoring' 
  | 'streaming';

export interface AIProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: 'remote' | 'local';
  readonly capabilities: AICapability[];
  readonly priority: number;

  // Core AI operations
  ask(prompt: string, context?: AIContext): Promise<string>;
  complete(code: string, position?: number): Promise<string>;
  isAvailable(): Promise<boolean>;

  // Optional streaming support
  askStream?(prompt: string, callback: (chunk: string) => void, context?: AIContext): Promise<void>;
  
  // Provider lifecycle
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: ConversationId;
  title: string;
  messages: ConversationMessage[];
  context: AIContext;
  provider: ProviderId;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIEngineConfig {
  defaultProvider?: ProviderId;
  fallbackEnabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
}

export interface AIEngine {
  // Provider management
  addProvider(provider: AIProvider): void;
  removeProvider(providerId: ProviderId): void;
  setProviderPriority(providerId: ProviderId, priority: number): void;
  getProvider(providerId: ProviderId): AIProvider | null;
  listProviders(): AIProvider[];

  // Core AI operations
  ask(prompt: string, context?: AIContext, providerId?: ProviderId): Promise<string>;
  completeCode(code: string, position?: number, context?: AIContext): Promise<string>;
  explainCode(code: string, context?: AIContext): Promise<string>;
  generateFunction(description: string, context?: AIContext): Promise<string>;
  refactorCode(code: string, instruction: string, context?: AIContext): Promise<string>;

  // Conversation management
  startConversation(providerId?: ProviderId): ConversationId;
  continueConversation(id: ConversationId, message: string, context?: AIContext): Promise<string>;
  endConversation(id: ConversationId): void;
  getConversation(id: ConversationId): Conversation | null;
  listConversations(): Conversation[];

  // Streaming support
  askStream(prompt: string, callback: (chunk: string) => void, context?: AIContext, providerId?: ProviderId): Promise<void>;

  // Configuration
  configure(config: AIEngineConfig): void;
  getConfig(): AIEngineConfig;

  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

export interface AIError extends Error {
  code: 'PROVIDER_UNAVAILABLE' | 'QUOTA_EXCEEDED' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'UNKNOWN';
  providerId?: ProviderId;
  retryable: boolean;
}