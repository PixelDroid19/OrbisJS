/**
 * Tests for Error Handler and Debugging System
 * Tests comprehensive error handling, source mapping, and debugging capabilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ErrorHandler, 
  BabelTransformationError,
  type ErrorContext,
  type DetailedError,
  type ErrorSuggestion
} from '../ErrorHandler.js';
import type { WebContainerInstance } from '../../types.js';
import type { BabelGlobalConfig } from '../types.js';

// Mock WebContainer instance
const createMockWebContainer = (): WebContainerInstance => {
  return {
    fs: {
      writeFile: vi.fn(),
      readFile: vi.fn(),
      readdir: vi.fn(),
      rm: vi.fn()
    },
    spawn: vi.fn().mockResolvedValue({
      exit: Promise.resolve(0),
      kill: vi.fn()
    })
  } as any;
};

describe('BabelTransformationError', () => {
  it('should create error with basic information', () => {
    const context: ErrorContext = {
      code: 'const x = 1;',
      config: { presets: [], plugins: [] },
      phase: 'transformation'
    };

    const error = new BabelTransformationError(
      'Test error message',
      'syntax',
      context
    );

    expect(error.message).toBe('Test error message');
    expect(error.type).toBe('syntax');
    expect(error.context).toBe(context);
    expect(error.suggestions).toEqual([]);
    expect(error.stackTrace).toBeInstanceOf(Array);
  });

  it('should extract location from original error', () => {
    const context: ErrorContext = {
      code: 'const x = 1;\nconst y = 2;',
      config: { presets: [], plugins: [] },
      phase: 'parsing'
    };

    const originalError = new Error('Syntax error') as any;
    originalError.loc = { line: 2, column: 5 };

    const error = new BabelTransformationError(
      'Syntax error',
      'syntax',
      context,
      originalError
    );

    expect(error.location).toBeDefined();
    expect(error.location?.line).toBe(2);
    expect(error.location?.column).toBe(5);
    expect(error.location?.source).toBe('const y = 2;');
  });

  it('should parse stack trace correctly', () => {
    const context: ErrorContext = {
      code: 'const x = 1;',
      config: { presets: [], plugins: [] },
      phase: 'transformation'
    };

    const originalError = new Error('Test error');
    originalError.stack = `Error: Test error
    at Object.transform (/path/to/babel.js:123:45)
    at processFile (/path/to/file.js:67:89)`;

    const error = new BabelTransformationError(
      'Test error',
      'runtime',
      context,
      originalError
    );

    expect(error.stackTrace).toHaveLength(2);
    expect(error.stackTrace[0]).toEqual({
      functionName: 'Object.transform',
      fileName: '/path/to/babel.js',
      lineNumber: 123,
      columnNumber: 45,
      source: '/path/to/babel.js:123:45'
    });
  });

  it('should allow adding suggestions and debug info', () => {
    const context: ErrorContext = {
      code: 'const x = 1;',
      config: { presets: [], plugins: [] },
      phase: 'transformation'
    };

    const error = new BabelTransformationError(
      'Test error',
      'configuration',
      context
    );

    const suggestion: ErrorSuggestion = {
      type: 'config',
      description: 'Test suggestion',
      action: 'Do something',
      autoApplicable: true,
      priority: 'high'
    };

    error.addSuggestion(suggestion);
    error.addDebugInfo('testKey', 'testValue');

    expect(error.suggestions).toContain(suggestion);
    expect(error.debugInfo.testKey).toBe('testValue');
  });
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let mockContainer: WebContainerInstance;

  beforeEach(() => {
    mockContainer = createMockWebContainer();
    errorHandler = new ErrorHandler(mockContainer);
  });

  describe('Error Classification', () => {
    it('should classify syntax errors correctly', async () => {
      const syntaxError = new SyntaxError('Unexpected token }');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(syntaxError, context);

      expect(error.type).toBe('syntax');
      expect(error.message).toBe('Unexpected token }');
    });

    it('should classify plugin errors correctly', async () => {
      const pluginError = new Error('Plugin "test-plugin" not found');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: ['test-plugin'] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(pluginError, context);

      expect(error.type).toBe('plugin');
    });

    it('should classify dependency errors correctly', async () => {
      const dependencyError = new Error('Cannot resolve module "@babel/preset-react"');
      const context: ErrorContext = {
        code: 'const x = <div>Hello</div>;',
        config: { presets: ['@babel/preset-react'], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(dependencyError, context);

      expect(error.type).toBe('dependency');
    });

    it('should classify configuration errors correctly', async () => {
      const configError = new Error('Invalid option "invalidOption" in preset');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: [] },
        phase: 'validation'
      };

      const { error } = await errorHandler.handleTransformationError(configError, context);

      expect(error.type).toBe('configuration');
    });
  });

  describe('Suggestion Generation', () => {
    it('should suggest JSX preset for JSX syntax errors', async () => {
      const jsxError = new SyntaxError('Unexpected token < (JSX)');
      const context: ErrorContext = {
        code: 'const element = <div>Hello</div>;',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(jsxError, context);

      const jsxSuggestion = error.suggestions.find(s => 
        s.type === 'preset' && s.action.includes('@babel/preset-react')
      );

      expect(jsxSuggestion).toBeDefined();
      expect(jsxSuggestion?.autoApplicable).toBe(true);
      expect(jsxSuggestion?.priority).toBe('high');
    });

    it('should suggest TypeScript preset for TypeScript syntax', async () => {
      const tsError = new SyntaxError('Unexpected token : (TypeScript interface)');
      const context: ErrorContext = {
        code: 'interface User { name: string; }',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(tsError, context);

      const tsSuggestion = error.suggestions.find(s => 
        s.type === 'preset' && s.action.includes('@babel/preset-typescript')
      );

      expect(tsSuggestion).toBeDefined();
      expect(tsSuggestion?.autoApplicable).toBe(true);
    });

    it('should suggest plugins for modern syntax features', async () => {
      const optionalChainingError = new SyntaxError('Unexpected token ?.');
      const context: ErrorContext = {
        code: 'const value = obj?.prop?.nested;',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(optionalChainingError, context);

      const pluginSuggestion = error.suggestions.find(s => 
        s.type === 'plugin' && s.action.includes('optional-chaining')
      );

      expect(pluginSuggestion).toBeDefined();
      expect(pluginSuggestion?.autoApplicable).toBe(true);
    });

    it('should suggest dependency installation for missing plugins', async () => {
      const missingPluginError = new Error('Plugin "babel-plugin-custom" not found');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: ['babel-plugin-custom'] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(missingPluginError, context);

      const dependencySuggestion = error.suggestions.find(s => 
        s.type === 'dependency' && s.action.includes('npm install')
      );

      expect(dependencySuggestion).toBeDefined();
    });

    it('should provide memory optimization suggestions', async () => {
      const memoryError = new Error('JavaScript heap out of memory');
      const context: ErrorContext = {
        code: 'const x = 1;'.repeat(10000),
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(memoryError, context);

      const memorySuggestion = error.suggestions.find(s => 
        s.description.toLowerCase().includes('memory')
      );

      expect(memorySuggestion).toBeDefined();
      expect(memorySuggestion?.type).toBe('config');
    });
  });

  describe('Fallback Strategies', () => {
    it('should apply syntax removal fallback for optional chaining', async () => {
      const syntaxError = new SyntaxError('Unexpected token ?.');
      const context: ErrorContext = {
        code: 'const value = obj?.prop?.nested;',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { resolution } = await errorHandler.handleTransformationError(syntaxError, context);

      expect(resolution).toBeDefined();
      expect(resolution?.code).toContain('obj && obj.prop && prop.nested');
      expect(resolution?.warnings).toContain('Converted optional chaining to logical AND checks');
    });

    it('should apply syntax removal fallback for nullish coalescing', async () => {
      const syntaxError = new SyntaxError('Unexpected token ??');
      const context: ErrorContext = {
        code: 'const value = input ?? defaultValue;',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { resolution } = await errorHandler.handleTransformationError(syntaxError, context);

      expect(resolution).toBeDefined();
      expect(resolution?.code).toContain('!== null && input !== undefined');
      expect(resolution?.warnings).toContain('Converted nullish coalescing to explicit null/undefined checks');
    });

    it('should apply configuration simplification fallback', async () => {
      const configError = new Error('Invalid plugin configuration');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { 
          presets: ['@babel/preset-env', 'invalid-preset'], 
          plugins: ['invalid-plugin'] 
        },
        phase: 'validation'
      };

      const { resolution } = await errorHandler.handleTransformationError(configError, context);

      expect(resolution).toBeDefined();
      expect(resolution?.warnings).toContain('Simplified Babel configuration to basic preset only');
    });

    it('should apply ES5 fallback for modern syntax', async () => {
      const runtimeError = new Error('Arrow functions not supported');
      const context: ErrorContext = {
        code: 'const fn = (x) => x * 2; const value = 42;',
        config: { presets: [], plugins: [] },
        phase: 'execution'
      };

      const { resolution } = await errorHandler.handleTransformationError(runtimeError, context);

      expect(resolution).toBeDefined();
      expect(resolution?.code).toContain('var fn');
      expect(resolution?.code).toContain('function(');
      expect(resolution?.warnings).toContain('Converted const/let declarations to var');
      expect(resolution?.warnings).toContain('Converted arrow functions to regular functions');
    });
  });

  describe('Diagnostic Report Generation', () => {
    it('should generate comprehensive diagnostic report', async () => {
      const error1: DetailedError = {
        type: 'syntax',
        message: 'Syntax error',
        originalError: new Error('Syntax error'),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing'
        },
        suggestions: [{
          type: 'syntax',
          description: 'Fix syntax',
          action: 'Check syntax',
          autoApplicable: false,
          priority: 'high'
        }],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const config: BabelGlobalConfig = { presets: ['@babel/preset-env'], plugins: [] };
      const performance = { transformTime: 100, memoryUsage: 1024 };

      const report = await errorHandler.generateDiagnosticReport([error1], config, performance);

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.environment.nodeVersion).toBeDefined();
      expect(report.environment.babelVersion).toBeDefined();
      expect(report.environment.platform).toBeDefined();
      expect(report.configuration).toBe(config);
      expect(report.errors).toContain(error1);
      expect(report.performance).toBe(performance);
      expect(report.suggestions).toHaveLength(1);
    });

    it('should deduplicate suggestions in diagnostic report', async () => {
      const duplicateSuggestion: ErrorSuggestion = {
        type: 'preset',
        description: 'Add React preset',
        action: 'Add @babel/preset-react',
        autoApplicable: true,
        priority: 'high'
      };

      const error1: DetailedError = {
        type: 'syntax',
        message: 'JSX error 1',
        originalError: new Error(),
        context: { code: '', config: { presets: [], plugins: [] }, phase: 'parsing' },
        suggestions: [duplicateSuggestion],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const error2: DetailedError = {
        type: 'syntax',
        message: 'JSX error 2',
        originalError: new Error(),
        context: { code: '', config: { presets: [], plugins: [] }, phase: 'parsing' },
        suggestions: [duplicateSuggestion],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const report = await errorHandler.generateDiagnosticReport(
        [error1, error2], 
        { presets: [], plugins: [] }, 
        { transformTime: 100, memoryUsage: 1024 }
      );

      expect(report.suggestions).toHaveLength(1);
    });
  });

  describe('Auto-Apply Suggestions', () => {
    it('should auto-apply preset suggestions', async () => {
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const suggestions: ErrorSuggestion[] = [
        {
          type: 'preset',
          description: 'Add React preset',
          action: 'Add @babel/preset-react to your Babel configuration',
          autoApplicable: true,
          priority: 'high'
        },
        {
          type: 'preset',
          description: 'Add TypeScript preset',
          action: 'Add @babel/preset-typescript to your Babel configuration',
          autoApplicable: true,
          priority: 'high'
        }
      ];

      const { updatedConfig, appliedSuggestions } = await errorHandler.autoApplySuggestions(
        config, 
        suggestions
      );

      expect(updatedConfig.presets).toContain('@babel/preset-react');
      expect(updatedConfig.presets).toContain('@babel/preset-typescript');
      expect(appliedSuggestions).toHaveLength(2);
    });

    it('should auto-apply plugin suggestions', async () => {
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const suggestions: ErrorSuggestion[] = [
        {
          type: 'plugin',
          description: 'Add optional chaining plugin',
          action: 'Add @babel/plugin-transform-optional-chaining to your configuration',
          autoApplicable: true,
          priority: 'medium'
        }
      ];

      const { updatedConfig, appliedSuggestions } = await errorHandler.autoApplySuggestions(
        config, 
        suggestions
      );

      expect(updatedConfig.plugins).toContain('@babel/plugin-transform-optional-chaining');
      expect(appliedSuggestions).toHaveLength(1);
    });

    it('should skip non-auto-applicable suggestions', async () => {
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const suggestions: ErrorSuggestion[] = [
        {
          type: 'syntax',
          description: 'Fix syntax manually',
          action: 'Check your code syntax',
          autoApplicable: false,
          priority: 'high'
        }
      ];

      const { updatedConfig, appliedSuggestions } = await errorHandler.autoApplySuggestions(
        config, 
        suggestions
      );

      expect(updatedConfig).toEqual(config);
      expect(appliedSuggestions).toHaveLength(0);
    });

    it('should not duplicate existing presets/plugins', async () => {
      const config: BabelGlobalConfig = { 
        presets: ['@babel/preset-react'], 
        plugins: ['@babel/plugin-transform-optional-chaining'] 
      };
      
      const suggestions: ErrorSuggestion[] = [
        {
          type: 'preset',
          description: 'Add React preset',
          action: 'Add @babel/preset-react to your Babel configuration',
          autoApplicable: true,
          priority: 'high'
        },
        {
          type: 'plugin',
          description: 'Add optional chaining plugin',
          action: 'Add @babel/plugin-transform-optional-chaining to your configuration',
          autoApplicable: true,
          priority: 'medium'
        }
      ];

      const { updatedConfig, appliedSuggestions } = await errorHandler.autoApplySuggestions(
        config, 
        suggestions
      );

      expect(updatedConfig.presets).toHaveLength(1);
      expect(updatedConfig.plugins).toHaveLength(1);
      expect(appliedSuggestions).toHaveLength(0);
    });
  });

  describe('Error Formatting', () => {
    it('should format error for user display', () => {
      const error: DetailedError = {
        type: 'syntax',
        message: 'Unexpected token }',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing'
        },
        location: {
          line: 1,
          column: 12,
          source: 'const x = 1;'
        },
        suggestions: [
          {
            type: 'syntax',
            description: 'Check for missing brackets',
            action: 'Review your code for syntax errors',
            autoApplicable: false,
            priority: 'high'
          },
          {
            type: 'config',
            description: 'Update configuration',
            action: 'Check Babel configuration',
            autoApplicable: true,
            priority: 'medium'
          }
        ],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const formatted = errorHandler.formatErrorForUser(error);

      expect(formatted).toContain('❌ SYNTAX ERROR');
      expect(formatted).toContain('Unexpected token }');
      expect(formatted).toContain('📍 Location: Line 1, Column 12');
      expect(formatted).toContain('📝 Source: const x = 1;');
      expect(formatted).toContain('💡 Suggestions:');
      expect(formatted).toContain('🔥'); // High priority icon
      expect(formatted).toContain('⚠️'); // Medium priority icon
      expect(formatted).toContain('Check for missing brackets');
      expect(formatted).toContain('Update configuration');
    });

    it('should handle error without location', () => {
      const error: DetailedError = {
        type: 'configuration',
        message: 'Invalid configuration',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'validation'
        },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const formatted = errorHandler.formatErrorForUser(error);

      expect(formatted).toContain('❌ CONFIGURATION ERROR');
      expect(formatted).toContain('Invalid configuration');
      expect(formatted).not.toContain('📍 Location');
    });

    it('should handle error without suggestions', () => {
      const error: DetailedError = {
        type: 'runtime',
        message: 'Runtime error',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'execution'
        },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const formatted = errorHandler.formatErrorForUser(error);

      expect(formatted).toContain('❌ RUNTIME ERROR');
      expect(formatted).not.toContain('💡 Suggestions');
    });
  });

  describe('Source Mapping', () => {
    it('should map error to source with context', () => {
      const error: DetailedError = {
        type: 'syntax',
        message: 'Error message',
        originalError: new Error(),
        context: {
          code: 'line 1\nline 2\nline 3\nline 4\nline 5',
          config: { presets: [], plugins: [] },
          phase: 'parsing'
        },
        location: { line: 3, column: 5 },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const mapped = errorHandler.mapErrorToSource(error);

      expect(mapped).toBeDefined();
      expect(mapped?.line).toBe(3);
      expect(mapped?.column).toBe(5);
      expect(mapped?.source).toContain('line 3');
    });

    it('should handle source map parsing', () => {
      const error: DetailedError = {
        type: 'syntax',
        message: 'Error message',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing'
        },
        location: { line: 1, column: 5 },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const sourceMap = {
        version: 3,
        sources: ['original.js'],
        mappings: 'AAAA',
        names: []
      };

      const mapped = errorHandler.mapErrorToSource(error, sourceMap);

      expect(mapped).toBeDefined();
      expect(mapped?.line).toBe(1);
      expect(mapped?.column).toBe(5);
    });

    it('should handle invalid source maps gracefully', () => {
      const error: DetailedError = {
        type: 'syntax',
        message: 'Error message',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing'
        },
        location: { line: 1, column: 5 },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: {}
      };

      const invalidSourceMap = 'invalid json';

      const mapped = errorHandler.mapErrorToSource(error, invalidSourceMap);

      expect(mapped).toBeDefined();
      expect(mapped?.line).toBe(1);
      expect(mapped?.column).toBe(5);
    });

    it('should map stack traces through source maps', () => {
      const stackTrace: StackFrame[] = [
        {
          functionName: 'testFunction',
          fileName: 'transformed.js',
          lineNumber: 10,
          columnNumber: 5
        }
      ];

      const sourceMap = {
        version: 3,
        sources: ['original.js'],
        mappings: 'AAAA',
        names: []
      };

      const mappedStack = errorHandler.mapStackTrace(stackTrace, sourceMap);

      expect(mappedStack).toHaveLength(1);
      expect(mappedStack[0].functionName).toBe('testFunction');
      expect(mappedStack[0].lineNumber).toBe(10);
    });
  });

  describe('Debug Mode and Reporting', () => {
    it('should enable and disable debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      errorHandler.enableDebugMode(true);
      expect(consoleSpy).toHaveBeenCalledWith('🐛 Debug mode enabled');

      errorHandler.enableDebugMode(false);
      expect(consoleSpy).toHaveBeenCalledWith('🐛 Debug mode disabled');

      consoleSpy.mockRestore();
    });

    it('should create detailed transformation report', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: ['@babel/preset-env'], plugins: [] };
      const result: TransformResult = {
        code: 'var x = 1;',
        metadata: {
          originalSize: 12,
          transformedSize: 10,
          appliedPresets: ['@babel/preset-env'],
          appliedPlugins: [],
          warnings: [],
          dependencies: []
        },
        performance: {
          transformTime: 50,
          executionTime: 0,
          totalTime: 50,
          memoryUsage: 1024,
          cacheHit: false
        }
      };

      const report = errorHandler.createTransformationReport(code, config, result);

      expect(report).toContain('📊 TRANSFORMATION REPORT');
      expect(report).toContain('📥 INPUT:');
      expect(report).toContain('✅ RESULT:');
      expect(report).toContain('🌍 ENVIRONMENT:');
      expect(report).toContain('Code length: 12 characters');
      expect(report).toContain('Transformed code length: 10 characters');
    });

    it('should create error report when transformation fails', () => {
      const code = 'const x = 1;';
      const config: BabelGlobalConfig = { presets: [], plugins: [] };
      const error: DetailedError = {
        type: 'syntax',
        message: 'Syntax error',
        originalError: new Error(),
        context: { code, config, phase: 'parsing' },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: { phase: 'parsing' }
      };

      const report = errorHandler.createTransformationReport(code, config, undefined, error);

      expect(report).toContain('📊 TRANSFORMATION REPORT');
      expect(report).toContain('❌ ERROR:');
      expect(report).toContain('Type: syntax');
      expect(report).toContain('Message: Syntax error');
    });
  });

  describe('Edge Cases and Error Resilience', () => {
    it('should handle errors without location information', async () => {
      const errorWithoutLocation = new Error('Generic error');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(errorWithoutLocation, context);

      expect(error.type).toBe('runtime');
      expect(error.location).toBeUndefined();
      expect(error.suggestions).toBeInstanceOf(Array);
    });

    it('should handle very large code inputs', async () => {
      const largeCode = 'const x = 1;\n'.repeat(10000);
      const memoryError = new Error('JavaScript heap out of memory');
      const context: ErrorContext = {
        code: largeCode,
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(memoryError, context);

      expect(error.type).toBe('runtime');
      expect(error.suggestions.some(s => s.description.toLowerCase().includes('memory'))).toBe(true);
    });

    it('should handle circular reference in debug info', async () => {
      const circularError = new Error('Circular reference error');
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      // Create circular reference
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      (circularError as any).circular = circularObj;

      const { error } = await errorHandler.handleTransformationError(circularError, context);

      expect(error).toBeDefined();
      expect(error.debugInfo).toBeDefined();
    });

    it('should handle malformed stack traces', () => {
      const context: ErrorContext = {
        code: 'const x = 1;',
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      const errorWithBadStack = new Error('Test error');
      errorWithBadStack.stack = 'Malformed\nstack\ntrace\nwithout\nproper\nformat';

      const transformationError = new BabelTransformationError(
        'Test error',
        'syntax',
        context,
        errorWithBadStack
      );

      expect(transformationError.stackTrace).toBeInstanceOf(Array);
      // Should handle malformed stack gracefully
    });

    it('should handle concurrent error processing', async () => {
      const errors = Array.from({ length: 5 }, (_, i) => 
        new Error(`Concurrent error ${i}`)
      );
      
      const contexts = errors.map((_, i) => ({
        code: `const x${i} = 1;`,
        config: { presets: [], plugins: [] },
        phase: 'transformation' as const
      }));

      const promises = errors.map((error, i) => 
        errorHandler.handleTransformationError(error, contexts[i])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.error.message).toBe(`Concurrent error ${i}`);
      });
    });

    it('should handle empty or null code inputs', async () => {
      const emptyCodeError = new Error('Empty code error');
      const context: ErrorContext = {
        code: '',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(emptyCodeError, context);

      expect(error).toBeDefined();
      expect(error.context.code).toBe('');
    });

    it('should provide helpful suggestions for common configuration mistakes', async () => {
      const configErrors = [
        { message: 'Cannot resolve preset "@babel/preset-react"', expectedSuggestion: 'dependency' },
        { message: 'Invalid option "invalidOption" in preset', expectedSuggestion: 'config' },
        { message: 'Plugin "unknown-plugin" not found', expectedSuggestion: 'dependency' },
        { message: 'Unexpected token "interface"', expectedSuggestion: 'preset' }
      ];

      for (const { message, expectedSuggestion } of configErrors) {
        const error = new Error(message);
        const context: ErrorContext = {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'transformation'
        };

        const { error: detailedError } = await errorHandler.handleTransformationError(error, context);
        
        expect(detailedError.suggestions.some(s => s.type === expectedSuggestion)).toBe(true);
      }
    });
  });
});