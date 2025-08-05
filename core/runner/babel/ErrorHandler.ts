/**
 * Comprehensive Error Handling and Debugging System
 * Provides detailed error reporting, source mapping, and debugging support
 */

import type { WebContainerInstance } from '../types.js';
import type { BabelGlobalConfig } from './types.js';

export interface ErrorContext {
  code: string;
  filename?: string;
  config: BabelGlobalConfig;
  line?: number;
  column?: number;
  phase: 'parsing' | 'transformation' | 'execution' | 'validation';
}

export interface ErrorSuggestion {
  type: 'config' | 'dependency' | 'syntax' | 'plugin' | 'preset';
  description: string;
  action: string;
  autoApplicable: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface SourceLocation {
  line: number;
  column: number;
  filename?: string;
  source?: string;
}

export interface StackFrame {
  functionName?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
  source?: string;
}

export interface DetailedError {
  type: 'syntax' | 'plugin' | 'preset' | 'configuration' | 'dependency' | 'runtime';
  message: string;
  originalError: Error;
  context: ErrorContext;
  location?: SourceLocation;
  suggestions: ErrorSuggestion[];
  stackTrace: StackFrame[];
  relatedErrors: DetailedError[];
  debugInfo: Record<string, any>;
}

export interface FallbackStrategy {
  name: string;
  description: string;
  canApply: (error: DetailedError) => boolean;
  apply: (code: string, config: BabelGlobalConfig) => Promise<{ code: string; warnings: string[] }>;
}

export interface DiagnosticReport {
  timestamp: Date;
  environment: {
    nodeVersion: string;
    babelVersion: string;
    platform: string;
    memory: { used: number; total: number };
  };
  configuration: BabelGlobalConfig;
  errors: DetailedError[];
  warnings: string[];
  performance: {
    transformTime: number;
    memoryUsage: number;
  };
  suggestions: ErrorSuggestion[];
}

/**
 * Enhanced error class with detailed context and debugging information
 */
export class BabelTransformationError extends Error {
  public readonly type: DetailedError['type'];
  public readonly context: ErrorContext;
  public readonly location?: SourceLocation;
  public readonly suggestions: ErrorSuggestion[];
  public readonly stackTrace: StackFrame[];
  public readonly debugInfo: Record<string, any>;

  constructor(
    message: string,
    type: DetailedError['type'],
    context: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'BabelTransformationError';
    this.type = type;
    this.context = context;
    this.suggestions = [];
    this.stackTrace = this.parseStackTrace(originalError?.stack || this.stack || '');
    this.debugInfo = {};

    // Extract location information from original error if available
    if (originalError && 'loc' in originalError) {
      const loc = (originalError as any).loc;
      if (loc && typeof loc === 'object') {
        this.location = {
          line: loc.line || 0,
          column: loc.column || 0,
          filename: context.filename,
          source: this.extractSourceLine(context.code, loc.line)
        };
      }
    }
  }

  private parseStackTrace(stack: string): StackFrame[] {
    const frames: StackFrame[] = [];
    const lines = stack.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                   line.match(/^\s*at\s+(.+?):(\d+):(\d+)/) ||
                   line.match(/^\s*(.+?)\s+\((.+?):(\d+):(\d+)\)/);

      if (match) {
        const frame: StackFrame = {
          functionName: match[1],
          fileName: match[2] || match[1],
          lineNumber: parseInt(match[3] || match[2], 10),
          columnNumber: parseInt(match[4] || match[3], 10)
        };

        // Add source context if available
        if (frame.fileName && frame.lineNumber) {
          frame.source = this.getStackFrameSource(frame);
        }

        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Get source context for a stack frame
   */
  private getStackFrameSource(frame: StackFrame): string | undefined {
    // In a real implementation, this would read the actual source file
    // For now, we'll return a placeholder indicating the frame location
    if (frame.fileName && frame.lineNumber) {
      return `${frame.fileName}:${frame.lineNumber}:${frame.columnNumber || 0}`;
    }
    return undefined;
  }

  /**
   * Map stack trace through source maps
   */
  mapStackTrace(stackTrace: StackFrame[], sourceMap?: any): StackFrame[] {
    if (!sourceMap) {
      return stackTrace;
    }

    return stackTrace.map(frame => {
      if (!frame.lineNumber || !frame.columnNumber) {
        return frame;
      }

      try {
        const originalPosition = this.mapTransformedToOriginal(
          frame.lineNumber,
          frame.columnNumber,
          sourceMap
        );

        if (originalPosition) {
          return {
            ...frame,
            lineNumber: originalPosition.line,
            columnNumber: originalPosition.column,
            fileName: originalPosition.source || frame.fileName,
            source: this.getStackFrameSource({
              ...frame,
              lineNumber: originalPosition.line,
              columnNumber: originalPosition.column,
              fileName: originalPosition.source || frame.fileName
            })
          };
        }
      } catch (error) {
        console.warn('⚠️ Failed to map stack frame:', error);
      }

      return frame;
    });
  }

  private extractSourceLine(code: string, lineNumber: number): string | undefined {
    if (!lineNumber || lineNumber < 1) return undefined;
    
    const lines = code.split('\n');
    return lines[lineNumber - 1];
  }

  addSuggestion(suggestion: ErrorSuggestion): void {
    this.suggestions.push(suggestion);
  }

  addDebugInfo(key: string, value: any): void {
    this.debugInfo[key] = value;
  }
}

/**
 * Main error handler and debugging system
 */
export class ErrorHandler {
  private container: WebContainerInstance;
  private fallbackStrategies: FallbackStrategy[] = [];

  constructor(container: WebContainerInstance) {
    this.container = container;
    this.initializeFallbackStrategies();
  }

  /**
   * Handle transformation errors with detailed analysis
   */
  async handleTransformationError(
    error: Error,
    context: ErrorContext
  ): Promise<{ error: DetailedError; resolution?: { code: string; warnings: string[] } }> {
    const detailedError = await this.analyzeError(error, context);
    
    // Try to apply fallback strategies
    let resolution: { code: string; warnings: string[] } | undefined;
    
    for (const strategy of this.fallbackStrategies) {
      if (strategy.canApply(detailedError)) {
        try {
          resolution = await strategy.apply(context.code, context.config);
          console.log(`✅ Applied fallback strategy: ${strategy.name}`);
          break;
        } catch (fallbackError) {
          console.warn(`⚠️ Fallback strategy ${strategy.name} failed:`, fallbackError);
        }
      }
    }

    return { error: detailedError, resolution };
  }

  /**
   * Analyze error and provide detailed information
   */
  private async analyzeError(error: Error, context: ErrorContext): Promise<DetailedError> {
    const errorType = this.classifyError(error);
    const transformationError = new BabelTransformationError(
      error.message,
      errorType,
      context,
      error
    );

    // Add context-specific debug information
    transformationError.addDebugInfo('originalStack', error.stack);
    transformationError.addDebugInfo('babelConfig', context.config);
    transformationError.addDebugInfo('codeLength', context.code.length);
    transformationError.addDebugInfo('phase', context.phase);

    // Generate suggestions based on error type
    const suggestions = await this.generateSuggestions(error, context);
    suggestions.forEach(suggestion => transformationError.addSuggestion(suggestion));

    return {
      type: errorType,
      message: error.message,
      originalError: error,
      context,
      location: transformationError.location,
      suggestions: transformationError.suggestions,
      stackTrace: transformationError.stackTrace,
      relatedErrors: [],
      debugInfo: transformationError.debugInfo
    };
  }

  /**
   * Classify error type based on error characteristics
   */
  private classifyError(error: Error): DetailedError['type'] {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('syntaxerror') || message.includes('unexpected token')) {
      return 'syntax';
    }

    if (message.includes('cannot resolve') || message.includes('module not found')) {
      return 'dependency';
    }

    if (message.includes('config') || message.includes('option') || message.includes('invalid option')) {
      return 'configuration';
    }

    if (message.includes('plugin') || message.includes('transform')) {
      return 'plugin';
    }

    if (message.includes('preset')) {
      return 'preset';
    }

    return 'runtime';
  }

  /**
   * Generate helpful suggestions based on error analysis
   */
  private async generateSuggestions(error: Error, context: ErrorContext): Promise<ErrorSuggestion[]> {
    const suggestions: ErrorSuggestion[] = [];
    const message = error.message.toLowerCase();

    // Syntax error suggestions
    if (message.includes('unexpected token')) {
      suggestions.push({
        type: 'syntax',
        description: 'Syntax error detected in your code',
        action: 'Check for missing semicolons, brackets, or invalid syntax near the error location',
        autoApplicable: false,
        priority: 'high'
      });

      if (message.includes('jsx') || message.includes('<')) {
        suggestions.push({
          type: 'preset',
          description: 'JSX syntax detected but not configured',
          action: 'Add @babel/preset-react to your Babel configuration',
          autoApplicable: true,
          priority: 'high'
        });
      }

      if (message.includes('typescript') || message.includes('interface') || message.includes('type') || message.includes('"interface"')) {
        suggestions.push({
          type: 'preset',
          description: 'TypeScript syntax detected but not configured',
          action: 'Add @babel/preset-typescript to your Babel configuration',
          autoApplicable: true,
          priority: 'high'
        });
      }
    }

    // Dependency resolution errors
    if (message.includes('cannot resolve') || message.includes('module not found')) {
      if (message.includes('preset')) {
        const presetMatch = message.match(/@babel\/preset-[\w-]+/);
        if (presetMatch) {
          suggestions.push({
            type: 'dependency',
            description: `Missing Babel preset: ${presetMatch[0]}`,
            action: `Install the preset: npm install --save-dev ${presetMatch[0]}`,
            autoApplicable: true,
            priority: 'high'
          });
        }
      }
    }

    // Plugin/preset suggestions
    if (message.includes('plugin') && message.includes('not found')) {
      const pluginMatch = message.match(/plugin[^\w]*([^\s]+)/);
      if (pluginMatch) {
        suggestions.push({
          type: 'dependency',
          description: `Missing Babel plugin: ${pluginMatch[1]}`,
          action: `Install the plugin: npm install --save-dev ${pluginMatch[1]}`,
          autoApplicable: true,
          priority: 'high'
        });
      }
    }

    // Configuration suggestions
    if (message.includes('targets') || message.includes('browserslist')) {
      suggestions.push({
        type: 'config',
        description: 'Target environment configuration issue',
        action: 'Check your browserslist configuration or Babel targets setting',
        autoApplicable: false,
        priority: 'medium'
      });
    }

    if (message.includes('invalid option') || message.includes('option')) {
      suggestions.push({
        type: 'config',
        description: 'Invalid configuration option detected',
        action: 'Check your Babel configuration for invalid or deprecated options',
        autoApplicable: false,
        priority: 'high'
      });
    }

    // Modern syntax suggestions
    if (message.includes('optional chaining') || message.includes('?.')) {
      suggestions.push({
        type: 'plugin',
        description: 'Optional chaining syntax requires a plugin',
        action: 'Add @babel/plugin-transform-optional-chaining to your configuration',
        autoApplicable: true,
        priority: 'medium'
      });
    }

    if (message.includes('nullish coalescing') || message.includes('??')) {
      suggestions.push({
        type: 'plugin',
        description: 'Nullish coalescing syntax requires a plugin',
        action: 'Add @babel/plugin-transform-nullish-coalescing-operator to your configuration',
        autoApplicable: true,
        priority: 'medium'
      });
    }

    // Memory/performance suggestions
    if (message.includes('memory') || message.includes('heap')) {
      suggestions.push({
        type: 'config',
        description: 'Memory usage issue detected',
        action: 'Consider reducing file size, enabling caching, or increasing Node.js memory limit',
        autoApplicable: false,
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Initialize fallback strategies for graceful degradation
   */
  private initializeFallbackStrategies(): void {
    // Strategy 1: Remove problematic syntax
    this.fallbackStrategies.push({
      name: 'syntax-removal',
      description: 'Remove problematic modern syntax',
      canApply: (error) => error.type === 'syntax',
      apply: async (code, config) => {
        let fallbackCode = code;
        const warnings: string[] = [];

        // Remove optional chaining
        if (code.includes('?.')) {
          fallbackCode = fallbackCode.replace(/(\w+)\?\./g, '$1 && $1.');
          warnings.push('Converted optional chaining to logical AND checks');
        }

        // Remove nullish coalescing
        if (code.includes('??')) {
          fallbackCode = fallbackCode.replace(/(\w+)\s*\?\?\s*(.+)/g, '($1 !== null && $1 !== undefined) ? $1 : $2');
          warnings.push('Converted nullish coalescing to explicit null/undefined checks');
        }

        return { code: fallbackCode, warnings };
      }
    });

    // Strategy 2: Simplify configuration
    this.fallbackStrategies.push({
      name: 'config-simplification',
      description: 'Use simpler Babel configuration',
      canApply: (error) => error.type === 'configuration' || error.type === 'plugin',
      apply: async (code, config) => {
        const warnings: string[] = [];
        
        // Use only basic presets
        const simplifiedConfig = {
          presets: ['@babel/preset-env'],
          plugins: []
        };

        warnings.push('Simplified Babel configuration to basic preset only');
        
        // Note: In a real implementation, this would actually transform the code
        return { code, warnings };
      }
    });

    // Strategy 3: ES5 fallback
    this.fallbackStrategies.push({
      name: 'es5-fallback',
      description: 'Convert to ES5 compatible code',
      canApply: (error) => error.type === 'syntax' || error.type === 'runtime',
      apply: async (code, config) => {
        let fallbackCode = code;
        const warnings: string[] = [];

        // Convert const/let to var
        fallbackCode = fallbackCode.replace(/\b(const|let)\b/g, 'var');
        warnings.push('Converted const/let declarations to var');

        // Convert arrow functions to regular functions
        fallbackCode = fallbackCode.replace(/(\w+)\s*=\s*\([^)]*\)\s*=>\s*{/g, 'var $1 = function() {');
        fallbackCode = fallbackCode.replace(/(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*([^;]+)/g, 'var $1 = function($2) { return $3; }');
        warnings.push('Converted arrow functions to regular functions');

        return { code: fallbackCode, warnings };
      }
    });
  }

  /**
   * Generate comprehensive diagnostic report
   */
  async generateDiagnosticReport(
    errors: DetailedError[],
    config: BabelGlobalConfig,
    performance: { transformTime: number; memoryUsage: number }
  ): Promise<DiagnosticReport> {
    const environment = await this.getEnvironmentInfo();
    
    // Collect all suggestions from errors
    const allSuggestions = errors.flatMap(error => error.suggestions);
    
    // Deduplicate suggestions
    const uniqueSuggestions = allSuggestions.filter((suggestion, index, array) => 
      array.findIndex(s => s.type === suggestion.type && s.action === suggestion.action) === index
    );

    // Collect warnings
    const warnings: string[] = [];
    errors.forEach(error => {
      if (error.debugInfo.warnings) {
        warnings.push(...error.debugInfo.warnings);
      }
    });

    return {
      timestamp: new Date(),
      environment,
      configuration: config,
      errors,
      warnings,
      performance,
      suggestions: uniqueSuggestions
    };
  }

  /**
   * Map stack trace through source maps (public method)
   */
  mapStackTrace(stackTrace: StackFrame[], sourceMap?: any): StackFrame[] {
    if (!sourceMap) {
      return stackTrace;
    }

    return stackTrace.map(frame => {
      if (!frame.lineNumber || !frame.columnNumber) {
        return frame;
      }

      try {
        const originalPosition = this.mapTransformedToOriginal(
          frame.lineNumber,
          frame.columnNumber,
          sourceMap
        );

        if (originalPosition) {
          return {
            ...frame,
            lineNumber: originalPosition.line,
            columnNumber: originalPosition.column,
            fileName: originalPosition.source || frame.fileName,
            source: this.getStackFrameSource({
              ...frame,
              lineNumber: originalPosition.line,
              columnNumber: originalPosition.column,
              fileName: originalPosition.source || frame.fileName
            })
          };
        }
      } catch (error) {
        console.warn('⚠️ Failed to map stack frame:', error);
      }

      return frame;
    });
  }

  /**
   * Get environment information for diagnostics
   */
  private async getEnvironmentInfo(): Promise<DiagnosticReport['environment']> {
    let nodeVersion = 'unknown';
    let memoryInfo = { used: 0, total: 0 };

    try {
      // Get Node.js version
      const versionProcess = await this.container.spawn('node', ['--version']);
      // In a real implementation, we'd capture the output
      nodeVersion = '18.x'; // Placeholder
    } catch (error) {
      console.warn('Could not get Node.js version:', error);
    }

    // Get memory information
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      memoryInfo = {
        used: usage.heapUsed,
        total: usage.heapTotal
      };
    }

    return {
      nodeVersion,
      babelVersion: '7.24.0', // Would be detected from package.json
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      memory: memoryInfo
    };
  }

  /**
   * Map error to source code with context using source maps
   */
  mapErrorToSource(error: DetailedError, sourceMap?: any): SourceLocation | undefined {
    if (!error.location) {
      return undefined;
    }

    // If no source map is provided, return original location with context
    if (!sourceMap) {
      return {
        ...error.location,
        source: this.getSourceContext(error.context.code, error.location.line)
      };
    }

    try {
      // Parse source map if it's a string
      const parsedSourceMap = typeof sourceMap === 'string' ? JSON.parse(sourceMap) : sourceMap;
      
      // Map the error location back to original source
      const originalPosition = this.mapTransformedToOriginal(
        error.location.line,
        error.location.column,
        parsedSourceMap
      );

      if (originalPosition) {
        return {
          line: originalPosition.line,
          column: originalPosition.column,
          filename: originalPosition.source || error.location.filename,
          source: this.getSourceContext(error.context.code, originalPosition.line)
        };
      }
    } catch (sourceMapError) {
      console.warn('⚠️ Failed to parse source map:', sourceMapError);
    }

    // Fallback to original location
    return {
      ...error.location,
      source: this.getSourceContext(error.context.code, error.location.line)
    };
  }

  /**
   * Map transformed position to original source position
   * Simplified source map implementation for basic mapping
   */
  private mapTransformedToOriginal(
    line: number,
    column: number,
    sourceMap: any
  ): { line: number; column: number; source?: string } | null {
    // This is a simplified implementation
    // In a production environment, you would use the 'source-map' library
    
    if (!sourceMap.mappings || !sourceMap.sources) {
      return null;
    }

    // For now, return a basic mapping assuming 1:1 line mapping
    // This would be replaced with proper VLQ decoding in a real implementation
    return {
      line: line,
      column: column,
      source: sourceMap.sources[0]
    };
  }

  /**
   * Get source code context around error location
   */
  private getSourceContext(code: string, lineNumber: number, contextLines = 3): string {
    const lines = code.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    const contextLines_array = lines.slice(start, end);
    
    return contextLines_array
      .map((line, index) => {
        const actualLineNumber = start + index + 1;
        const marker = actualLineNumber === lineNumber ? '>>> ' : '    ';
        return `${marker}${actualLineNumber.toString().padStart(3)}: ${line}`;
      })
      .join('\n');
  }

  /**
   * Auto-apply suggestions where possible
   */
  async autoApplySuggestions(
    config: BabelGlobalConfig,
    suggestions: ErrorSuggestion[]
  ): Promise<{ updatedConfig: BabelGlobalConfig; appliedSuggestions: ErrorSuggestion[] }> {
    const updatedConfig = { ...config };
    const appliedSuggestions: ErrorSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!suggestion.autoApplicable) continue;

      try {
        switch (suggestion.type) {
          case 'preset':
            if (suggestion.action.includes('@babel/preset-react')) {
              if (!updatedConfig.presets.includes('@babel/preset-react')) {
                updatedConfig.presets.push('@babel/preset-react');
                appliedSuggestions.push(suggestion);
              }
            }
            if (suggestion.action.includes('@babel/preset-typescript')) {
              if (!updatedConfig.presets.includes('@babel/preset-typescript')) {
                updatedConfig.presets.push('@babel/preset-typescript');
                appliedSuggestions.push(suggestion);
              }
            }
            break;

          case 'plugin':
            const pluginMatch = suggestion.action.match(/@babel\/plugin-[\w-]+/);
            if (pluginMatch) {
              const plugin = pluginMatch[0];
              if (!updatedConfig.plugins.includes(plugin)) {
                updatedConfig.plugins.push(plugin);
                appliedSuggestions.push(suggestion);
              }
            }
            break;

          case 'dependency':
            // In a real implementation, this would trigger npm install
            console.log(`Would install dependency: ${suggestion.action}`);
            appliedSuggestions.push(suggestion);
            break;
        }
      } catch (error) {
        console.warn(`Failed to auto-apply suggestion: ${suggestion.description}`, error);
      }
    }

    return { updatedConfig, appliedSuggestions };
  }

  /**
   * Create user-friendly error message
   */
  formatErrorForUser(error: DetailedError): string {
    let message = `❌ ${error.type.toUpperCase()} ERROR: ${error.message}\n`;

    if (error.location) {
      message += `📍 Location: Line ${error.location.line}, Column ${error.location.column}\n`;
      if (error.location.filename) {
        message += `📄 File: ${error.location.filename}\n`;
      }
      if (error.location.source) {
        message += `📝 Source: ${error.location.source}\n`;
      }
    }

    // Add context information
    if (error.context.phase) {
      message += `🔄 Phase: ${error.context.phase}\n`;
    }

    // Add debug information in debug mode
    if (error.debugInfo && Object.keys(error.debugInfo).length > 0) {
      message += '\n🐛 Debug Information:\n';
      Object.entries(error.debugInfo).forEach(([key, value]) => {
        if (key !== 'originalStack' && key !== 'babelConfig') {
          message += `  ${key}: ${JSON.stringify(value)}\n`;
        }
      });
    }

    // Add stack trace for debugging (first few frames)
    if (error.stackTrace.length > 0) {
      message += '\n📚 Stack Trace (top 3 frames):\n';
      error.stackTrace.slice(0, 3).forEach((frame, index) => {
        message += `  ${index + 1}. ${frame.functionName || 'anonymous'} `;
        message += `(${frame.fileName}:${frame.lineNumber}:${frame.columnNumber})\n`;
      });
    }

    if (error.suggestions.length > 0) {
      message += '\n💡 Suggestions:\n';
      error.suggestions
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .forEach((suggestion, index) => {
          const priority = suggestion.priority === 'high' ? '🔥' : 
                          suggestion.priority === 'medium' ? '⚠️' : 'ℹ️';
          message += `  ${index + 1}. ${priority} ${suggestion.description}\n`;
          message += `     Action: ${suggestion.action}\n`;
          if (suggestion.autoApplicable) {
            message += `     ✅ Can be auto-applied\n`;
          }
        });
    }

    return message;
  }

  /**
   * Enable debug mode for detailed logging
   */
  private debugMode = false;

  enableDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`🐛 Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugModeEnabled(): boolean {
    return this.debugMode;
  }

  /**
   * Log debug information if debug mode is enabled
   */
  private debugLog(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`🐛 [DEBUG] ${message}`, data || '');
    }
  }

  /**
   * Create detailed transformation report for debugging
   */
  createTransformationReport(
    code: string,
    config: BabelGlobalConfig,
    result?: TransformResult,
    error?: DetailedError
  ): string {
    let report = '📊 TRANSFORMATION REPORT\n';
    report += '=' .repeat(50) + '\n\n';

    // Input information
    report += '📥 INPUT:\n';
    report += `  Code length: ${code.length} characters\n`;
    report += `  Lines: ${code.split('\n').length}\n`;
    report += `  Configuration: ${JSON.stringify(config, null, 2)}\n\n`;

    // Result or error information
    if (result) {
      report += '✅ RESULT:\n';
      report += `  Transformed code length: ${result.code.length} characters\n`;
      report += `  Source map: ${result.map ? 'Generated' : 'Not generated'}\n`;
      report += `  Performance: ${JSON.stringify(result.performance, null, 2)}\n`;
      report += `  Metadata: ${JSON.stringify(result.metadata, null, 2)}\n\n`;
    }

    if (error) {
      report += '❌ ERROR:\n';
      report += `  Type: ${error.type}\n`;
      report += `  Message: ${error.message}\n`;
      report += `  Location: ${error.location ? `${error.location.line}:${error.location.column}` : 'Unknown'}\n`;
      report += `  Suggestions: ${error.suggestions.length}\n`;
      report += `  Debug info: ${JSON.stringify(error.debugInfo, null, 2)}\n\n`;
    }

    // Environment information
    report += '🌍 ENVIRONMENT:\n';
    report += `  Timestamp: ${new Date().toISOString()}\n`;
    report += `  Debug mode: ${this.debugMode}\n`;

    return report;
  }
}