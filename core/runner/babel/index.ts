/**
 * Modern Babel Transformer System
 * Complete entry point for the enhanced Babel transformation ecosystem
 * 
 * This module provides a comprehensive, modern Babel transformation system
 * designed for WebContainer environments with advanced features including:
 * - Intelligent feature detection
 * - Performance optimization with caching
 * - Framework-specific configurations
 * - Error handling and debugging
 * - Language and framework detection
 * - WebContainer integration
 */

import type { WebContainerInstance } from '../types.js';
import type { TransformOptions, BabelGlobalConfig } from './types.js';
import { AdvancedFeatureDetector } from './AdvancedFeatureDetector.js';
import { BabelConfigManager } from './BabelConfigManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { LanguageDetector } from './LanguageDetector.js';
import { ModernBabelTransformer } from './ModernBabelTransformer.js';
import { OptimizationOptions, PerformanceOptimizer } from './PerformanceOptimizer.js';
import { InitializationOptions, WebContainerInitializer } from './WebContainerInitializer.js';

// ============================================================================
// CORE TRANSFORMATION SYSTEM
// ============================================================================

// Main transformer
export { ModernBabelTransformer } from './ModernBabelTransformer.js';

// Configuration management
export { BabelConfigManager } from './BabelConfigManager.js';
export { BabelConfigTemplates, BabelDependencies } from './ModernBabelConfig.js';

// Feature detection and analysis
export { AdvancedFeatureDetector } from './AdvancedFeatureDetector.js';
export { LanguageDetector } from './LanguageDetector.js';

// Error handling and debugging
export { ErrorHandler } from './ErrorHandler.js';

// Performance optimization
export { PerformanceOptimizer, TransformationCache, IncrementalCompiler, MemoryManager } from './PerformanceOptimizer.js';

// ============================================================================
// WEBCONTAINER INTEGRATION
// ============================================================================

// WebContainer managers
export { WebContainerPackageManager } from './WebContainerPackageManager.js';
export { WebContainerInitializer } from './WebContainerInitializer.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Core types
export type {
  // Language and framework types
  SupportedLanguage,
  SupportedFramework,
  TargetEnvironment,
  
  // Configuration types
  BabelGlobalConfig,
  PresetConfig,
  PluginConfig,
  TargetConfig,
  LanguageConfig,
  ReactConfig,
  SolidConfig,
  VueConfig,
  
  // Transform types
  TransformOptions,
  TransformResult,
  TransformMetadata,
  TransformWarning,
  
  // Performance types
  PerformanceMetrics,
  CacheEntry,
  CacheStats,
  
  // Error types
  TransformationError,
  ErrorSuggestion,
  
  // Validation types
  ValidationResult,
  ValidationError,
  ValidationWarning,
  
  // Detection types
  LanguageInfo,
  FrameworkInfo,
  LanguageFeature,
  FeatureSupport,
  DependencyInfo,
  DetectionStrategy,
  FrameworkDetectionResult,
  
  // Utility types
  SourceMap,
  BabelAST,
  ParserOptions,
  GeneratorOptions,
  PresetInfo,
  PluginInfo
} from './types.js';

// Additional types from specific modules
export type { ProjectType } from './ModernBabelConfig.js';
export type { OptimizationOptions } from './PerformanceOptimizer.js';
export type { WebContainerInitOptions } from './WebContainerPackageManager.js';
export type { InitializationResult, InitializationOptions } from './WebContainerInitializer.js';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

// Default transformer instance (singleton)
export { ModernBabelTransformer as default } from './ModernBabelTransformer.js';

// Quick access to commonly used classes
export {
  BabelConfigTemplates as Templates,
  BabelDependencies as Dependencies
} from './ModernBabelConfig.js';

export {
  AdvancedFeatureDetector as FeatureDetector
} from './AdvancedFeatureDetector.js';

export {
  LanguageDetector as Detector
} from './LanguageDetector.js';

export {
  PerformanceOptimizer as Optimizer
} from './PerformanceOptimizer.js';

export {
  WebContainerInitializer as Initializer
} from './WebContainerInitializer.js';

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a complete Babel transformation system for WebContainer
 */
export async function createBabelSystem(
  container: WebContainerInstance, 
  options?: { optimization?: OptimizationOptions }
) {
  const transformer = ModernBabelTransformer.getInstance();
  const initializer = new WebContainerInitializer(container);
  const optimizer = new PerformanceOptimizer(container, options?.optimization);
  
  return {
    transformer,
    initializer,
    optimizer,
    async initialize(initOptions?: InitializationOptions) {
      const defaultOptions: InitializationOptions = {
        projectType: 'javascript',
        enableESModules: true,
        nodeVersion: '18',
        installDependencies: true,
        createBabelRC: true,
        createBabelConfigJS: false,
        skipDependencyInstall: false,
        timeout: 60000
      };
      return await initializer.initialize(initOptions || defaultOptions);
    },
    async transform(code: string, transformOptions?: TransformOptions) {
      return await transformer.transformCode(code, transformOptions);
    },
    async optimizedTransform(code: string, config: BabelGlobalConfig, transformOptions?: TransformOptions) {
      return await optimizer.optimizeTransformation(code, config, transformOptions);
    }
  };
}

/**
 * Create a language detector with default configuration
 */
export function createLanguageDetector() {
  return new LanguageDetector();
}

/**
 * Create a feature detector with default configuration
 */
export function createFeatureDetector() {
  return new AdvancedFeatureDetector();
}

/**
 * Create a configuration manager with default settings
 */
export function createConfigManager() {
  return BabelConfigManager.getInstance();
}

/**
 * Create an error handler with WebContainer instance
 */
export function createErrorHandler(container: WebContainerInstance) {
  return new ErrorHandler(container);
}

// ============================================================================
// VERSION AND METADATA
// ============================================================================

export const BABEL_SYSTEM_VERSION = '2.0.0';
export const SUPPORTED_BABEL_VERSION = '^7.23.0';
export const SUPPORTED_NODE_VERSION = '>=18.0.0';

export const SYSTEM_INFO = {
  name: 'Modern Babel Transformer System',
  version: BABEL_SYSTEM_VERSION,
  description: 'Advanced Babel transformation system for WebContainer environments',
  features: [
    'Intelligent feature detection',
    'Performance optimization with caching',
    'Framework-specific configurations',
    'Error handling and debugging',
    'Language and framework detection',
    'WebContainer integration',
    'Incremental compilation',
    'Memory management',
    'TypeScript support',
    'JSX/TSX support',
    'Modern JavaScript features',
    'Source map generation'
  ],
  supportedFrameworks: ['react', 'solid', 'vue', 'svelte'],
  supportedLanguages: ['javascript', 'typescript', 'jsx', 'tsx'],
  supportedEnvironments: ['node', 'browser', 'webworker']
} as const;