/**
 * Core types for WebContainer-based code execution
 * Based on official WebContainer API documentation
 */

// Import WebContainer types from the actual library
import type { WebContainer as WebContainerType } from '@webcontainer/api';

// WebContainer instance type - compatible with actual WebContainer
export type WebContainerInstance = WebContainerType;

// File System API types - compatible with WebContainer's FileSystemAPI
export type FileSystemAPI = WebContainerType['fs'];

// Process execution types - compatible with WebContainer's spawn result
export type WebContainerProcess = Awaited<ReturnType<WebContainerType['spawn']>>;

// Process execution types - now using WebContainer's native types
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

// File system tree structure for WebContainer
import type { FileSystemTree as WebContainerFileSystemTree } from '@webcontainer/api';
export type FileSystemTree = WebContainerFileSystemTree;

// DirEnt type - exported from WebContainer API
export type { DirEnt as Dirent } from '@webcontainer/api';

// Execution result types
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  timestamp: Date;
}

// Output event types
export interface OutputEvent {
  type: 'stdout' | 'stderr' | 'log';
  content: string;
  timestamp: Date;
}

// Error event types
export interface ErrorEvent {
  type: 'execution' | 'system' | 'timeout';
  message: string;
  stack?: string;
  timestamp: Date;
}

// Process status
export type ProcessStatus = 'idle' | 'running' | 'completed' | 'error' | 'killed';

// Configuration options
export interface RunnerConfig {
  timeout?: number;
  maxOutputSize?: number;
  workingDirectory?: string;
  enableStderr?: boolean;
  autoInstallPackages?: boolean;
}

// File system entry
export interface FileSystemEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
}



// Process information
export interface ProcessInfo {
  status: ProcessStatus;
  hasTimeout: boolean;
  startTime?: Date;
}

// Language support
export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'shell';

export interface LanguageConfig {
  extension: string;
  command: string;
  args?: string[];
  runtime?: string;
}

// Singleton management
export interface SingletonState {
  instance: WebContainerInstance | null;
  isBooting: boolean;
  bootPromise: Promise<WebContainerInstance> | null;
  bootCount: number;
  lastBootTime: number;
}