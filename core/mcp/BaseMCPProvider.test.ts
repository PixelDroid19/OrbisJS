/**
 * Unit tests for BaseMCPProvider and DefaultMCPProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseMCPProvider, DefaultMCPProvider } from './BaseMCPProvider.js';
import type { MCPContext, MCPAction, ProcessedContext, ActionResult } from './types.js';

// Concrete implementation for testing BaseMCPProvider
class TestMCPProvider extends BaseMCPProvider {
  constructor() {
    super('test-provider', 'Test MCP Provider', ['context_processing', 'action_execution']);
  }

  async processContext(context: MCPContext): Promise<ProcessedContext> {
    return {
      summary: 'Test context processing',
      relevantFiles: ['test.js'],
      suggestions: ['Test suggestion'],
      metadata: { test: true }
    };
  }

  async executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    if (action.type === 'test-action') {
      return this.createSuccessResult([], { executed: true });
    }
    return this.createErrorResult('Unsupported action type');
  }
}

describe('BaseMCPProvider', () => {
  let provider: TestMCPProvider;
  let mockContext: MCPContext;
  let mockAction: MCPAction;

  beforeEach(() => {
    provider = new TestMCPProvider();
    
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'console.log("test");',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false
      },
      project: {
        structure: {
          'test.js': {
            type: 'file',
            content: 'console.log("test");'
          }
        },
        config: {},
        dependencies: []
      },
      execution: {
        history: [],
        environment: {}
      },
      user: {
        preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true },
        recentActions: [],
        activeFeatures: []
      }
    };

    mockAction = {
      id: 'test-action-1',
      type: 'test-action',
      target: {
        type: 'selection',
        range: {
          from: { line: 0, column: 0 },
          to: { line: 0, column: 7 }
        }
      },
      parameters: {},
      timestamp: new Date()
    };
  });

  describe('constructor and properties', () => {
    it('should initialize with correct properties', () => {
      expect(provider.id).toBe('test-provider');
      expect(provider.name).toBe('Test MCP Provider');
      expect(provider.capabilities).toEqual(['context_processing', 'action_execution']);
    });
  });

  describe('lifecycle methods', () => {
    it('should have default initialize method', async () => {
      await expect(provider.initialize()).resolves.not.toThrow();
    });

    it('should have default destroy method', async () => {
      await expect(provider.destroy()).resolves.not.toThrow();
    });
  });

  describe('helper methods', () => {
    it('should create success results', () => {
      const result = provider['createSuccessResult']([], { test: true });
      
      expect(result.success).toBe(true);
      expect(result.changes).toEqual([]);
      expect(result.metadata).toEqual({ test: true });
      expect(result.error).toBeUndefined();
    });

    it('should create error results', () => {
      const result = provider['createErrorResult']('Test error', { context: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.metadata).toEqual({ context: 'test' });
      expect(result.changes).toBeUndefined();
    });

    it('should check capabilities', () => {
      expect(provider['hasCapability']('context_processing')).toBe(true);
      expect(provider['hasCapability']('action_execution')).toBe(true);
      expect(provider['hasCapability']('real_time_updates')).toBe(false);
    });

    it('should validate actions', () => {
      expect(provider['validateAction'](mockAction)).toBe(true);
      
      const invalidAction = { ...mockAction, id: '' };
      expect(provider['validateAction'](invalidAction as MCPAction)).toBe(false);
    });

    it('should extract relevant context', () => {
      const relevant = provider['extractRelevantContext'](mockContext, mockAction);
      
      expect(relevant.id).toBe(mockContext.id);
      expect(relevant.timestamp).toBe(mockContext.timestamp);
      expect(relevant.buffer).toBe(mockContext.buffer);
    });

    it('should generate change IDs', () => {
      const id1 = provider['generateChangeId']();
      const id2 = provider['generateChangeId']();
      
      expect(id1).toMatch(/^change_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^change_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('abstract method implementations', () => {
    it('should process context', async () => {
      const result = await provider.processContext(mockContext);
      
      expect(result.summary).toBe('Test context processing');
      expect(result.relevantFiles).toEqual(['test.js']);
      expect(result.suggestions).toEqual(['Test suggestion']);
      expect(result.metadata).toEqual({ test: true });
    });

    it('should execute actions', async () => {
      const result = await provider.executeAction(mockAction, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.metadata).toEqual({ executed: true });
    });
  });
});

describe('DefaultMCPProvider', () => {
  let provider: DefaultMCPProvider;
  let mockContext: MCPContext;

  beforeEach(() => {
    provider = new DefaultMCPProvider();
    
    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'function test() {\n  console.log("test");\n}',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false,
        selection: {
          from: { line: 0, column: 0 },
          to: { line: 2, column: 1 },
          text: 'function test() {\n  console.log("test");\n}'
        }
      },
      project: {
        structure: {
          'test.js': { type: 'file', content: 'console.log("test");' },
          'utils.ts': { type: 'file', content: 'export const util = () => {};' },
          'styles.css': { type: 'file', content: 'body { margin: 0; }' }
        },
        config: {},
        dependencies: []
      },
      execution: {
        history: [],
        environment: {}
      },
      user: {
        preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true },
        recentActions: [],
        activeFeatures: []
      }
    };
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(provider.id).toBe('default');
      expect(provider.name).toBe('Default MCP Provider');
      expect(provider.capabilities).toEqual(['context_processing', 'action_execution']);
    });
  });

  describe('processContext', () => {
    it('should process context and identify relevant files', async () => {
      const result = await provider.processContext(mockContext);
      
      expect(result.summary).toContain('2 code files');
      expect(result.summary).toContain('javascript');
      expect(result.relevantFiles).toEqual(['test.js', 'utils.ts']);
      expect(result.suggestions).toHaveLength(3);
      expect(result.metadata.bufferSize).toBe(mockContext.buffer.content.length);
      expect(result.metadata.projectFiles).toBe(3);
    });

    it('should handle empty project structure', async () => {
      const emptyContext = {
        ...mockContext,
        project: { ...mockContext.project, structure: {} }
      };
      
      const result = await provider.processContext(emptyContext);
      
      expect(result.summary).toContain('0 code files');
      expect(result.relevantFiles).toEqual([]);
      expect(result.metadata.projectFiles).toBe(0);
    });
  });

  describe('executeAction', () => {
    it('should handle explain actions', async () => {
      const action: MCPAction = {
        id: 'explain-1',
        type: 'explain',
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await provider.executeAction(action, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.explanation).toContain('javascript code');
      expect(result.metadata?.codeLength).toBe(mockContext.buffer.selection?.text?.length);
      expect(result.metadata?.language).toBe('javascript');
    });

    it('should handle document actions', async () => {
      const action: MCPAction = {
        id: 'document-1',
        type: 'document',
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await provider.executeAction(action, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0].type).toBe('insert');
      expect(result.changes?.[0].content).toContain('/**');
      expect(result.metadata?.documentationType).toBe('jsdoc');
    });

    it('should handle format actions', async () => {
      const action: MCPAction = {
        id: 'format-1',
        type: 'format',
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await provider.executeAction(action, mockContext);
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes?.[0].type).toBe('replace');
      expect(result.metadata?.formattingApplied).toBe(true);
    });

    it('should handle unsupported actions', async () => {
      const action: MCPAction = {
        id: 'unsupported-1',
        type: 'unsupported-action' as any,
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      };

      const result = await provider.executeAction(action, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action type');
    });

    it('should handle invalid actions', async () => {
      const invalidAction = {
        id: '',
        type: 'explain',
        target: { type: 'selection' },
        parameters: {},
        timestamp: new Date()
      } as MCPAction;

      const result = await provider.executeAction(invalidAction, mockContext);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid action format');
    });
  });

  describe('documentation generation', () => {
    it('should generate function documentation', () => {
      const code = 'function test() { return true; }';
      const doc = provider['generateDocumentation'](code, 'javascript');
      
      expect(doc).toContain('/**');
      expect(doc).toContain('Description of this function');
      expect(doc).toContain('@returns');
    });

    it('should generate class documentation', () => {
      const code = 'class TestClass { constructor() {} }';
      const doc = provider['generateDocumentation'](code, 'javascript');
      
      expect(doc).toContain('/**');
      expect(doc).toContain('Description of this class');
    });

    it('should generate generic documentation for other code', () => {
      const code = 'const x = 42;';
      const doc = provider['generateDocumentation'](code, 'javascript');
      
      expect(doc).toContain('/**');
      expect(doc).toContain('Code documentation');
    });
  });

  describe('code formatting', () => {
    it('should format code by normalizing whitespace', () => {
      const code = '  function test()   {\n\n    return true;\n\n  }  ';
      const formatted = provider['formatCode'](code, 'javascript');
      
      expect(formatted).toBe('function test()   {\nreturn true;\n}');
    });

    it('should handle empty lines', () => {
      const code = 'line1\n\n\nline2\n\n';
      const formatted = provider['formatCode'](code, 'javascript');
      
      expect(formatted).toBe('line1\nline2');
    });
  });
});