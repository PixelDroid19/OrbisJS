/**
 * OrbisJS Core - Exportaciones principales
 * Sistema integrado de editor, ejecución y gestión de paquetes
 */

// Editor exports
export { EditorComponent, CodeMirrorEditorEngine } from './editor/index.js';
export type { EditorEngine, EditorComponentProps, EditorComponentRef } from './editor/index.js';

// Runner exports  
export { WebContainerRunner } from './runner/index.js';
export type { ExecutionResult, PackageInfo } from './runner/index.js';

// AI Engine exports
export { AIEngineImpl, BaseAIProvider, createAIEngine, getDefaultAIEngine, resetDefaultAIEngine } from './ai-engine/index.js';
export type { AIEngine, AIProvider, AIContext, AICapability, AIError, ConversationId, ProviderId, Conversation, ConversationMessage, AIEngineConfig, ProviderConfig } from './ai-engine/index.js';

// MCP exports
export * from './mcp/index.js';