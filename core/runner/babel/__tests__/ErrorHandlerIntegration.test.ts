/**
 * Integration tests for ErrorHandler with ModernBabelTransformer
 * Tests comprehensive error handling, source mapping, and debugging in real scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModernBabelTransformer } from '../ModernBabelTransformer.js';
import { ErrorHandler, type ErrorContext } from '../ErrorHandler.js';
import type { WebContainerInstance } from '../../types.js';

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

describe('ErrorHandler Integration with ModernBabelTransformer', () => {
  let transformer: ModernBabelTransformer;
  let errorHandler: ErrorHandler;
  let mockContainer: WebContainerInstance;

  beforeEach(() => {
    transformer = ModernBabelTransformer.getInstance();
    mockContainer = createMockWebContainer();
    transformer.setWebContainer(mockContainer);
    errorHandler = new ErrorHandler(mockContainer);
  });

  describe('Direct Error Handler Testing', () => {
    it('should handle JSX syntax errors with comprehensive suggestions', async () => {
      const jsxError = new SyntaxError('Unexpected token < (JSX)');
      const context: ErrorContext = {
        code: 'const element = <div>Hello World</div>;',
        filename: 'test.jsx',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error, resolution } = await errorHandler.handleTransformationError(jsxError, context);

      expect(error.type).toBe('syntax');
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions.length).toBeGreaterThan(0);
      
      // Should suggest React preset for JSX
      const reactSuggestion = error.suggestions.find(s => 
        s.type === 'preset' && s.action.includes('@babel/preset-react')
      );
      expect(reactSuggestion).toBeDefined();
      expect(reactSuggestion?.autoApplicable).toBe(true);
    });

    it('should provide fallback transformation for optional chaining errors', async () => {
      const optionalChainingError = new SyntaxError('Unexpected token ?.');
      const context: ErrorContext = {
        code: 'const value = obj?.prop?.nested?.value;',
        filename: 'modern.js',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error, resolution } = await errorHandler.handleTransformationError(optionalChainingError, context);

      expect(error.type).toBe('syntax');
      expect(resolution).toBeDefined();
      expect(resolution?.code).toContain('obj && obj.prop');
      expect(resolution?.warnings).toContain('Converted optional chaining to logical AND checks');
    });

    it('should handle TypeScript syntax errors with proper suggestions', async () => {
      const tsError = new SyntaxError('Unexpected token "interface"');
      const context: ErrorContext = {
        code: 'interface User { name: string; }',
        filename: 'test.ts',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(tsError, context);

      expect(error.suggestions).toBeDefined();
      
      // Should suggest TypeScript preset
      const tsSuggestion = error.suggestions.find(s => 
        s.type === 'preset' && s.action.includes('@babel/preset-typescript')
      );
      expect(tsSuggestion).toBeDefined();
      expect(tsSuggestion?.autoApplicable).toBe(true);
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle missing preset errors with auto-apply suggestions', async () => {
      const presetError = new Error('Cannot resolve preset "@babel/preset-react"');
      const context: ErrorContext = {
        code: 'const x = 1;',
        filename: 'test.js',
        config: { presets: ['@babel/preset-react'], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(presetError, context);

      expect(error.type).toBe('dependency');
      expect(error.suggestions).toBeDefined();
      
      // Should suggest installing missing preset
      const dependencySuggestion = error.suggestions.find(s => 
        s.type === 'dependency' && s.autoApplicable === true
      );
      expect(dependencySuggestion).toBeDefined();
    });

    it('should handle plugin configuration errors', async () => {
      const pluginError = new Error('Plugin "invalid-plugin-name" not found');
      const context: ErrorContext = {
        code: 'const x = 1;',
        filename: 'test.js',
        config: { presets: [], plugins: ['invalid-plugin-name'] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(pluginError, context);

      expect(error.type).toBe('plugin');
      expect(error.suggestions).toBeDefined();
    });

    it('should handle invalid configuration options', async () => {
      const configError = new Error('Invalid option "invalidOption" in preset');
      const context: ErrorContext = {
        code: 'const x = 1;',
        filename: 'test.js',
        config: { presets: [], plugins: [] },
        phase: 'validation'
      };

      const { error } = await errorHandler.handleTransformationError(configError, context);

      expect(error.type).toBe('configuration');
      expect(error.suggestions).toBeDefined();
      
      const configSuggestion = error.suggestions.find(s => s.type === 'config');
      expect(configSuggestion).toBeDefined();
    });
  });

  describe('Source Mapping and Debugging', () => {
    it('should provide source context for errors', async () => {
      const multiLineCode = `const first = 1;
const second = 2;
const invalid = <div>JSX without preset</div>;
const fourth = 4;`;

      const jsxError = new SyntaxError('Unexpected token <');
      (jsxError as any).loc = { line: 3, column: 17 };
      
      const context: ErrorContext = {
        code: multiLineCode,
        filename: 'multiline.js',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(jsxError, context);

      expect(error.location).toBeDefined();
      expect(error.location?.line).toBe(3);
      expect(error.location?.column).toBe(17);
      expect(error.location?.source).toContain('invalid');
    });

    it('should generate diagnostic reports for complex errors', async () => {
      const complexError = new SyntaxError('Unexpected token "interface"');
      const context: ErrorContext = {
        code: 'interface Props { name: string; } const jsx = <div>test</div>;',
        filename: 'complex.tsx',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(complexError, context);

      // Should have multiple suggestions for different issues
      expect(error.suggestions.length).toBeGreaterThan(0);
      
      // Should suggest both React and TypeScript presets
      const presetSuggestions = error.suggestions.filter(s => s.type === 'preset');
      expect(presetSuggestions.length).toBeGreaterThan(0);
    });

    it('should map errors through source maps', () => {
      const error = {
        type: 'syntax' as const,
        message: 'Test error',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing' as const
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
  });

  describe('Performance and Memory Error Handling', () => {
    it('should handle memory errors with optimization suggestions', async () => {
      const memoryError = new Error('JavaScript heap out of memory');
      const context: ErrorContext = {
        code: 'const x = 1;\n'.repeat(1000),
        filename: 'large.js',
        config: { presets: [], plugins: [] },
        phase: 'transformation'
      };

      const { error } = await errorHandler.handleTransformationError(memoryError, context);

      expect(error.suggestions).toBeDefined();
      
      const memorySuggestion = error.suggestions.find(s => 
        s.description.toLowerCase().includes('memory')
      );
      expect(memorySuggestion).toBeDefined();
      expect(memorySuggestion?.type).toBe('config');
    });

    it('should provide performance insights in debug mode', () => {
      errorHandler.enableDebugMode(true);

      const code = 'const x = 1;';
      const config = { presets: ['@babel/preset-env'], plugins: [] };

      const report = errorHandler.createTransformationReport(code, config);

      expect(report).toContain('📊 TRANSFORMATION REPORT');
      expect(report).toContain('🌍 ENVIRONMENT:');
      expect(report).toContain('Debug mode: true');
    });
  });

  describe('Fallback Strategy Integration', () => {
    it('should apply multiple fallback strategies in sequence', async () => {
      const syntaxError = new SyntaxError('Unexpected token ?.');
      const context: ErrorContext = {
        code: 'const value = obj?.prop ?? "default";',
        filename: 'fallback.js',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error, resolution } = await errorHandler.handleTransformationError(syntaxError, context);

      expect(error.suggestions).toBeDefined();
      expect(resolution).toBeDefined();
      expect(resolution?.warnings).toBeDefined();
      expect(resolution?.warnings.length).toBeGreaterThan(0);
    });

    it('should handle cascading errors gracefully', async () => {
      const cascadingError = new SyntaxError('Unexpected token < (JSX)');
      const context: ErrorContext = {
        code: 'const jsx = <div>test</div>; interface Props { name: string; }',
        filename: 'cascading.tsx',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(cascadingError, context);

      // Should identify multiple issues and provide comprehensive suggestions
      expect(error.suggestions.length).toBeGreaterThan(0);
      
      // Should have suggestions for different types of issues
      const suggestionTypes = new Set(error.suggestions.map(s => s.type));
      expect(suggestionTypes.size).toBeGreaterThan(0);
    });

    it('should auto-apply compatible suggestions', async () => {
      const config = { presets: [], plugins: [] };
      const suggestions = [
        {
          type: 'preset' as const,
          description: 'Add React preset',
          action: 'Add @babel/preset-react to your Babel configuration',
          autoApplicable: true,
          priority: 'high' as const
        },
        {
          type: 'plugin' as const,
          description: 'Add optional chaining plugin',
          action: 'Add @babel/plugin-transform-optional-chaining to your configuration',
          autoApplicable: true,
          priority: 'medium' as const
        }
      ];

      const { updatedConfig, appliedSuggestions } = await errorHandler.autoApplySuggestions(
        config,
        suggestions
      );

      expect(updatedConfig.presets).toContain('@babel/preset-react');
      expect(updatedConfig.plugins).toContain('@babel/plugin-transform-optional-chaining');
      expect(appliedSuggestions).toHaveLength(2);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle concurrent error processing', async () => {
      const errors = [
        new SyntaxError('JSX error'),
        new Error('Plugin error'),
        new Error('Configuration error')
      ];
      
      const contexts = errors.map((_, i) => ({
        code: `const test${i} = 1;`,
        filename: `test${i}.js`,
        config: { presets: [], plugins: [] },
        phase: 'transformation' as const
      }));

      const promises = errors.map((error, i) => 
        errorHandler.handleTransformationError(error, contexts[i])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, i) => {
        expect(result.error).toBeDefined();
        expect(result.error.context.filename).toBe(`test${i}.js`);
      });
    });

    it('should maintain error context across operations', async () => {
      const asyncError = new SyntaxError('Async syntax error');
      const context: ErrorContext = {
        code: 'async function test() { return obj?.prop; }',
        filename: 'async.jsx',
        config: { presets: [], plugins: [] },
        phase: 'parsing'
      };

      const { error } = await errorHandler.handleTransformationError(asyncError, context);

      expect(error.context).toBeDefined();
      expect(error.context.filename).toBe('async.jsx');
      expect(error.context.phase).toBe('parsing');
      expect(error.debugInfo).toBeDefined();
    });

    it('should generate comprehensive diagnostic reports', async () => {
      const testError = {
        type: 'syntax' as const,
        message: 'Test error',
        originalError: new Error(),
        context: {
          code: 'const x = 1;',
          config: { presets: [], plugins: [] },
          phase: 'parsing' as const
        },
        suggestions: [],
        stackTrace: [],
        relatedErrors: [],
        debugInfo: { testInfo: 'test value' }
      };

      const config = { presets: ['@babel/preset-env'], plugins: [] };
      const performance = { transformTime: 100, memoryUsage: 1024 };

      const report = await errorHandler.generateDiagnosticReport([testError], config, performance);

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.environment).toBeDefined();
      expect(report.configuration).toBe(config);
      expect(report.errors).toContain(testError);
      expect(report.performance).toBe(performance);
    });
  });
});