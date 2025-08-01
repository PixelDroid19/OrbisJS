/**
 * Model Context Protocol (MCP) Client - Main exports
 * Provides rich context sharing between AI assistants and code environment
 */

// Core types and interfaces
export type {
  MCPClient,
  MCPContext,
  MCPContextId,
  MCPAction,
  MCPActionId,
  MCPProvider,
  MCPProviderId,
  ActionResult,
  ProjectContext,
  ExecutionContext,
  BufferContext,
  UserContext,
  MCPClientConfig,
  MCPContextChangeEvent,
  ContextChange,
  MCPError,
  MCPActionType,
  MCPCapability,
  ActionTarget,
  CodeChange,
  ProcessedContext,
  FileTree,
  FileNode,
  ProjectConfig,
  PackageInfo,
  ProcessInfo,
  UserPreferences,
  UserAction
} from './types.js';

// Action system types
export type {
  ActionDefinition,
  ActionHandler
} from './ActionRegistry.js';

export type {
  ActionBatch,
  BatchResult,
  ActionTransaction
} from './ActionWorkflow.js';

export type {
  RollbackSnapshot,
  BufferState,
  RollbackResult
} from './RollbackManager.js';

export type {
  ProviderInfo,
  ProviderStatus,
  ProviderMetrics,
  ProviderSelectionCriteria
} from './ProviderManager.js';

export type {
  ProtocolMessage,
  MessageType,
  ContextRequest,
  ContextResponse,
  ActionRequest,
  ActionResponse,
  ErrorResponse,
  ContextProcessingOptions,
  ActionExecutionOptions,
  ProtocolConfig
} from './CommunicationProtocol.js';

// Core implementations
export { MCPClientImpl } from './MCPClient.js';
export { ContextCollector } from './ContextCollector.js';
export { ActionExecutor } from './ActionExecutor.js';
export { ActionRegistry } from './ActionRegistry.js';
export { ActionWorkflow } from './ActionWorkflow.js';
export { RollbackManager, RollbackUtils } from './RollbackManager.js';
export { ProviderManager } from './ProviderManager.js';
export { CommunicationProtocol } from './CommunicationProtocol.js';

// Provider base classes
export { BaseMCPProvider, DefaultMCPProvider } from './BaseMCPProvider.js';

// Factory function for creating MCP Client instance
import { MCPClientImpl } from './MCPClient.js';
import { MCPClientConfig } from './types.js';

/**
 * Create a new MCP Client instance with optional configuration
 */
export function createMCPClient(config?: Partial<MCPClientConfig>): MCPClientImpl {
  return new MCPClientImpl(config);
}

/**
 * Default MCP Client instance (singleton)
 */
let defaultInstance: MCPClientImpl | null = null;

/**
 * Get the default MCP Client instance
 */
export function getDefaultMCPClient(): MCPClientImpl {
  if (!defaultInstance) {
    defaultInstance = createMCPClient();
  }
  return defaultInstance;
}

/**
 * Reset the default MCP Client instance (useful for testing)
 */
export function resetDefaultMCPClient(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}

/**
 * Create a default MCP provider for testing and fallback
 */
export async function createDefaultProvider() {
  const { DefaultMCPProvider } = await import('./BaseMCPProvider.js');
  return new DefaultMCPProvider();
}