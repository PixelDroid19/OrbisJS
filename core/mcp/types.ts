/**
 * Model Context Protocol (MCP) types and interfaces
 * Provides rich context sharing between AI assistants and code environment
 */

import type { Position, Selection, Buffer } from '../editor/types.js';
import type { ExecutionResult } from '../runner/types.js';

// Core MCP types
export type MCPContextId = string;
export type MCPActionId = string;
export type MCPProviderId = string;

// Context interfaces
export interface MCPContext {
  id: MCPContextId;
  timestamp: Date;
  buffer: BufferContext;
  project: ProjectContext;
  execution: ExecutionContext;
  user: UserContext;
}

export interface BufferContext {
  content: string;
  language: string;
  selection?: Selection;
  cursor: Position;
  path?: string;
  modified: boolean;
}

export interface ProjectContext {
  structure: FileTree;
  config: ProjectConfig;
  dependencies: PackageInfo[];
  rootPath?: string;
}

export interface ExecutionContext {
  history: ExecutionResult[];
  currentProcess?: ProcessInfo;
  environment: Record<string, string>;
}

export interface UserContext {
  preferences: UserPreferences;
  recentActions: UserAction[];
  activeFeatures: string[];
}

// File system types
export interface FileTree {
  [path: string]: FileNode;
}

export interface FileNode {
  type: 'file' | 'directory';
  content?: string;
  size?: number;
  modified?: Date;
  children?: FileTree;
}

// Project configuration
export interface ProjectConfig {
  name?: string;
  type?: 'javascript' | 'typescript' | 'mixed';
  entry?: string;
  packageJson?: PackageJson;
  tsconfig?: TSConfig;
  buildSettings?: BuildSettings;
}

export interface PackageInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface TSConfig {
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
}

export interface BuildSettings {
  target?: string;
  outDir?: string;
  sourceMap?: boolean;
}

// Process information
export interface ProcessInfo {
  pid?: number;
  status: 'idle' | 'running' | 'completed' | 'error' | 'killed';
  command?: string;
  startTime?: Date;
  endTime?: Date;
}

// User preferences and actions
export interface UserPreferences {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  aiProvider?: string;
}

export interface UserAction {
  type: 'edit' | 'execute' | 'save' | 'ai_request' | 'plugin_action';
  timestamp: Date;
  details: Record<string, unknown>;
}

// MCP Actions
export interface MCPAction {
  id: MCPActionId;
  type: MCPActionType;
  target: ActionTarget;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

export type MCPActionType = 
  | 'refactor' 
  | 'rename' 
  | 'document' 
  | 'generate' 
  | 'explain'
  | 'format'
  | 'optimize';

export interface ActionTarget {
  type: 'selection' | 'file' | 'function' | 'class' | 'project';
  path?: string;
  range?: Selection;
  identifier?: string;
}

export interface ActionResult {
  success: boolean;
  changes?: CodeChange[];
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CodeChange {
  type: 'insert' | 'replace' | 'delete';
  path: string;
  range?: Selection;
  content?: string;
}

// MCP Provider interface
export interface MCPProvider {
  readonly id: MCPProviderId;
  readonly name: string;
  readonly capabilities: MCPCapability[];

  // Context operations
  processContext(context: MCPContext): Promise<ProcessedContext>;
  
  // Action execution
  executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult>;
  
  // Provider lifecycle
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

export type MCPCapability = 
  | 'context_processing'
  | 'action_execution'
  | 'real_time_updates'
  | 'rollback_support';

export interface ProcessedContext {
  summary: string;
  relevantFiles: string[];
  suggestions: string[];
  metadata: Record<string, unknown>;
}

// MCP Client interface
export interface MCPClient {
  // Context collection
  getCurrentContext(): Promise<MCPContext>;
  getProjectContext(): Promise<ProjectContext>;
  getExecutionContext(): Promise<ExecutionContext>;
  
  // Context streaming
  onContextChange(callback: (context: MCPContext) => void): void;
  offContextChange(callback: (context: MCPContext) => void): void;
  
  // Action execution
  executeAction(action: MCPAction): Promise<ActionResult>;
  rollbackAction(actionId: MCPActionId): Promise<boolean>;
  
  // Provider management
  registerProvider(provider: MCPProvider): Promise<void>;
  unregisterProvider(providerId: MCPProviderId): Promise<void>;
  getProvider(providerId: MCPProviderId): MCPProvider | null;
  listProviders(): MCPProvider[];
  
  // Action history
  getActionHistory(): MCPAction[];
  clearActionHistory(): void;
  
  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

// Configuration
export interface MCPClientConfig {
  enableRealTimeUpdates: boolean;
  contextUpdateInterval: number;
  maxHistorySize: number;
  enableActionHistory: boolean;
}

// Events
export interface MCPContextChangeEvent {
  type: 'context_change';
  context: MCPContext;
  changes: ContextChange[];
}

export interface ContextChange {
  path: string;
  type: 'buffer' | 'project' | 'execution' | 'user';
  oldValue?: unknown;
  newValue?: unknown;
}

// Error types
export interface MCPError extends Error {
  code: 'CONTEXT_COLLECTION_FAILED' | 'ACTION_EXECUTION_FAILED' | 'PROVIDER_ERROR' | 'ROLLBACK_FAILED';
  providerId?: MCPProviderId;
  actionId?: MCPActionId;
  retryable: boolean;
}

// Action definition interface (re-exported from ActionRegistry)
export interface ActionDefinition {
  type: MCPActionType;
  name: string;
  description: string;
  supportedTargets: ActionTarget['type'][];
  requiredParameters: string[];
  optionalParameters: string[];
  handler: (action: MCPAction, context: MCPContext) => Promise<ActionResult>;
}