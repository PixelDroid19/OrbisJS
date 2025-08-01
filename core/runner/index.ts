/**
 * WebContainer Runner - Main exports
 * Safe code execution engine based on WebContainer API
 */

import { WebContainerManager } from './WebContainerManager.js';
import { WebContainerRunner } from './WebContainerRunner.js';

// Main runner
export { WebContainerRunner } from './WebContainerRunner.js';

// Managers
export { WebContainerManager } from './WebContainerManager.js';
export { FileSystemManager } from './FileSystemManager.js';
export { ProcessManager } from './ProcessManager.js';
export { BabelTransformer } from './BabelTransformer.js';
export { PackageManager } from './PackageManager.js';

// Types
export type {
  WebContainerInstance,
  FileSystemAPI,
  WebContainerProcess,
  FileSystemTree,
  ExecutionResult,
  OutputEvent,
  ErrorEvent,
  ProcessStatus,
  RunnerConfig,
  FileSystemEntry,
  Dirent,
  ProcessInfo,
  SupportedLanguage,
  LanguageConfig,
  SingletonState,
  SpawnOptions
} from './types.js';

// BabelTransformer types
export type { BabelConfig } from './BabelTransformer.js';

// PackageManager types
export type {
  PackageInfo,
  PackageInstallOptions,
  PackageDetectionResult,
  DetectedImport,
  DetectedRequire,
  PackageSuggestion,
  PackageManagerConfig,
  InstallProgress
} from './PackageManager.js';

// Re-export WebContainer types from @webcontainer/api
export type { WebContainer } from '@webcontainer/api';

// Utility functions
export const createRunner = (config?: import('./types.js').RunnerConfig) => {
  return new WebContainerRunner(config);
};

export const getRunnerInstance = () => {
  return WebContainerManager.getInstance();
};