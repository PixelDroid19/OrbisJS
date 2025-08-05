/**
 * Modern Babel Transformer Types
 * Comprehensive type definitions for the enhanced Babel transformation system
 */

// Core transformation types
export type SupportedLanguage = 'javascript' | 'typescript' | 'jsx' | 'tsx';
export type SupportedFramework = 'react' | 'solid' | 'vue' | 'svelte';
export type TargetEnvironment = 'node' | 'browser' | 'webworker';

// Transform options interface
export interface TransformOptions {
  filename?: string;
  language?: SupportedLanguage;
  framework?: SupportedFramework;
  target?: TargetEnvironment;
  sourceMaps?: boolean;
  minify?: boolean;
  customConfig?: Partial<BabelGlobalConfig>;
}

// Transform result interface
export interface TransformResult {
  code: string;
  map?: SourceMap;
  ast?: BabelAST;
  metadata: TransformMetadata;
  performance: PerformanceMetrics;
}

// Transform metadata
export interface TransformMetadata {
  originalSize: number;
  transformedSize: number;
  appliedPresets: string[];
  appliedPlugins: string[];
  warnings: TransformWarning[];
  dependencies: string[];
}

// Performance metrics
export interface PerformanceMetrics {
  transformTime: number;
  cacheHit: boolean;
  memoryUsage?: number;
  astParseTime?: number;
  codeGenTime?: number;
}

// Transform warning
export interface TransformWarning {
  type: 'deprecation' | 'compatibility' | 'performance';
  message: string;
  line?: number;
  column?: number;
  plugin?: string;
}

// Source map interface
export interface SourceMap {
  version: number;
  sources: string[];
  names: string[];
  mappings: string;
  file?: string;
  sourceRoot?: string;
  sourcesContent?: string[];
}

// Babel AST interface (simplified)
export interface BabelAST {
  type: string;
  body: unknown[];
  sourceType: 'module' | 'script';
  [key: string]: unknown;
}

// Global Babel configuration
export interface BabelGlobalConfig {
  presets: PresetConfig[];
  plugins: PluginConfig[];
  targets: TargetConfig;
  sourceType: 'module' | 'script' | 'unambiguous';
  assumptions: Record<string, boolean>;
  parserOpts: ParserOptions;
  generatorOpts: GeneratorOptions;
  env: Record<string, Partial<BabelGlobalConfig>>;
}

// Preset configuration
export interface PresetConfig {
  name: string;
  options?: Record<string, unknown>;
}

// Plugin configuration
export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

// Target configuration
export interface TargetConfig {
  browsers?: string[];
  node?: string;
  esmodules?: boolean;
  custom?: Record<string, string>;
}

// Parser options
export interface ParserOptions {
  strictMode?: boolean;
  allowImportExportEverywhere?: boolean;
  allowReturnOutsideFunction?: boolean;
  ranges?: boolean;
  tokens?: boolean;
  plugins?: string[];
}

// Generator options
export interface GeneratorOptions {
  auxiliaryCommentBefore?: string;
  auxiliaryCommentAfter?: string;
  shouldPrintComment?: (comment: string) => boolean;
  retainLines?: boolean;
  compact?: boolean | 'auto';
  minified?: boolean;
  concise?: boolean;
  quotes?: 'single' | 'double';
  filename?: string;
  sourceMaps?: boolean;
  sourceMapTarget?: string;
  sourceRoot?: string;
  sourceFileName?: string;
}

// Simplified language-specific configurations
export interface LanguageConfig {
  preset?: string;
  targets?: TargetConfig;
  modules?: 'auto' | 'commonjs' | 'esm' | false;
  jsx?: boolean;
  typescript?: boolean;
  [key: string]: unknown; // Allow flexible configuration
}

// Framework configurations
export interface ReactConfig {
  runtime?: 'automatic' | 'classic';
  importSource?: string;
  pragma?: string;
  pragmaFrag?: string;
  throwIfNamespace?: boolean;
  pure?: boolean;
  useBuiltIns?: boolean;
  useSpread?: boolean;
}

export interface SolidConfig {
  moduleName?: string;
  functionName?: string;
  delegateEvents?: boolean;
  wrapConditionals?: boolean;
  contextToCustomElements?: boolean;
  builtIns?: string[];
}

export interface VueConfig {
  functional?: boolean;
  injectH?: boolean;
  vModel?: boolean;
  vOn?: boolean;
}

// Cache-related types
export interface CacheEntry {
  key: string;
  originalCode: string;
  transformedCode: string;
  config: BabelGlobalConfig;
  metadata: TransformMetadata;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageTransformTime: number;
  cacheEfficiency: number;
}

// Error types
export interface TransformationError extends Error {
  type: 'syntax' | 'plugin' | 'preset' | 'configuration';
  code: string;
  line?: number;
  column?: number;
  filename?: string;
  babelError?: unknown;
  suggestions: ErrorSuggestion[];
}

export interface ErrorSuggestion {
  type: 'config' | 'dependency' | 'syntax' | 'plugin';
  description: string;
  action: string;
  autoApplicable: boolean;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: unknown;
}

// Preset and plugin info
export interface PresetInfo {
  name: string;
  version: string;
  description: string;
  options: Record<string, unknown>;
  dependencies: string[];
  frameworks: SupportedFramework[];
}

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  options: Record<string, unknown>;
  dependencies: string[];
  stage: number;
}

// Language detection types
export interface LanguageInfo {
  language: SupportedLanguage;
  confidence: number;
  features: LanguageFeature[];
  framework?: SupportedFramework;
  version?: string;
  requiresTranspilation: boolean;
}

export interface FrameworkInfo {
  name: SupportedFramework;
  version?: string;
  confidence: number;
  requiredPresets: string[];
  requiredPlugins: string[];
}

export interface LanguageFeature {
  name: string;
  type: 'syntax' | 'api' | 'import';
  support: FeatureSupport;
  requiredPlugin?: string;
}

export interface FeatureSupport {
  native: boolean;
  transpilable: boolean;
  minimumVersion?: string;
}

export interface DependencyInfo {
  name: string;
  type: 'dependency' | 'devDependency' | 'babel-preset' | 'babel-plugin';
  required: boolean;
  version: string;
}

export type DetectionStrategy = 'fast' | 'comprehensive' | 'ast-only' | 'pattern-only';

export interface FrameworkDetectionResult {
  frameworks: FrameworkInfo[];
  confidence: number;
  requiredDependencies: string[];
}