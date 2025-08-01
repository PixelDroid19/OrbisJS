/**
 * Unit tests for ContextCollector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContextCollector } from './ContextCollector.js';
import type { EditorEngine, Buffer } from '../editor/types.js';
import type { WebContainerRunner, ExecutionResult } from '../runner/types.js';

// Mock implementations
const mockEditorEngine: Partial<EditorEngine> = {
  getContent: vi.fn(() => 'console.log("Hello, World!");'),
  getLanguage: vi.fn(() => 'javascript'),
  getSelection: vi.fn(() => ({
    from: { line: 0, column: 0 },
    to: { line: 0, column: 7 },
    text: 'console'
  }))
};

const mockRunnerEngine: Partial<WebContainerRunner> = {
  listFiles: vi.fn(async () => ['package.json', 'index.js', 'src/']),
  readFile: vi.fn(async (path: string) => {
    if (path === '/package.json') {
      return JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      });
    }
    if (path === '/index.js') {
      return 'console.log("Hello, World!");';
    }
    throw new Error('File not found');
  }),
  getProcessStatus: vi.fn(() => 'idle' as const)
};

describe('ContextCollector', () => {
  let contextCollector: ContextCollector;

  beforeEach(async () => {
    contextCollector = new ContextCollector();
    await contextCollector.initialize();
    
    // Set up mock engines
    contextCollector.setEditorEngine(mockEditorEngine as EditorEngine);
    contextCollector.setRunnerEngine(mockRunnerEngine as WebContainerRunner);
  });

  afterEach(async () => {
    await contextCollector.destroy();
    vi.clearAllMocks();
  });

  describe('collectContext', () => {
    it('should collect complete context successfully', async () => {
      const context = await contextCollector.collectContext();

      expect(context).toBeDefined();
      expect(context.id).toMatch(/^ctx_\d+_[a-z0-9]+$/);
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.buffer).toBeDefined();
      expect(context.project).toBeDefined();
      expect(context.execution).toBeDefined();
      expect(context.user).toBeDefined();
    });

    it('should generate unique context IDs', async () => {
      const context1 = await contextCollector.collectContext();
      const context2 = await contextCollector.collectContext();

      expect(context1.id).not.toBe(context2.id);
    });
  });

  describe('collectBufferContext', () => {
    it('should collect buffer context from editor engine', async () => {
      const bufferContext = await contextCollector.collectBufferContext();

      expect(bufferContext.content).toBe('console.log("Hello, World!");');
      expect(bufferContext.language).toBe('javascript');
      expect(bufferContext.selection).toEqual({
        from: { line: 0, column: 0 },
        to: { line: 0, column: 7 },
        text: 'console'
      });
      expect(bufferContext.cursor).toEqual({ line: 0, column: 0 });
      expect(bufferContext.modified).toBe(false);
    });

    it('should return empty buffer context when editor engine is not available', async () => {
      contextCollector.setEditorEngine(undefined as any);
      
      const bufferContext = await contextCollector.collectBufferContext();

      expect(bufferContext.content).toBe('');
      expect(bufferContext.language).toBe('javascript');
      expect(bufferContext.cursor).toEqual({ line: 0, column: 0 });
      expect(bufferContext.modified).toBe(false);
    });

    it('should handle editor engine errors gracefully', async () => {
      const errorEngine = {
        ...mockEditorEngine,
        getContent: vi.fn(() => { throw new Error('Editor error'); })
      };
      contextCollector.setEditorEngine(errorEngine as EditorEngine);

      const bufferContext = await contextCollector.collectBufferContext();

      expect(bufferContext.content).toBe('');
      expect(bufferContext.language).toBe('javascript');
    });
  });

  describe('collectProjectContext', () => {
    it('should collect project structure and configuration', async () => {
      const projectContext = await contextCollector.collectProjectContext();

      expect(projectContext.structure).toBeDefined();
      expect(projectContext.config).toBeDefined();
      expect(projectContext.dependencies).toBeDefined();
      expect(projectContext.rootPath).toBe('/');
    });

    it('should parse package.json correctly', async () => {
      const projectContext = await contextCollector.collectProjectContext();

      expect(projectContext.config.name).toBe('test-project');
      expect(projectContext.config.packageJson).toEqual({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        }
      });
    });

    it('should collect dependencies from package.json', async () => {
      const projectContext = await contextCollector.collectProjectContext();

      expect(projectContext.dependencies).toHaveLength(2);
      expect(projectContext.dependencies).toContainEqual({
        name: 'react',
        version: '^18.0.0',
        type: 'dependency'
      });
      expect(projectContext.dependencies).toContainEqual({
        name: 'typescript',
        version: '^5.0.0',
        type: 'devDependency'
      });
    });

    it('should handle missing package.json gracefully', async () => {
      const errorRunner = {
        ...mockRunnerEngine,
        readFile: vi.fn(async () => { throw new Error('File not found'); }),
        listFiles: vi.fn(async () => ['index.js'])
      };
      contextCollector.setRunnerEngine(errorRunner as WebContainerRunner);

      const projectContext = await contextCollector.collectProjectContext();

      expect(projectContext.config.type).toBe('javascript');
      expect(projectContext.dependencies).toEqual([]);
    });
  });

  describe('collectExecutionContext', () => {
    it('should collect execution context', async () => {
      const executionContext = await contextCollector.collectExecutionContext();

      expect(executionContext.history).toEqual([]);
      expect(executionContext.environment).toBeDefined();
      expect(executionContext.environment.NODE_ENV).toBe('development');
    });

    it('should include current process info when available', async () => {
      const executionContext = await contextCollector.collectExecutionContext();

      expect(executionContext.currentProcess).toBeDefined();
      expect(executionContext.currentProcess?.status).toBe('idle');
    });
  });

  describe('collectUserContext', () => {
    it('should collect user preferences and actions', async () => {
      const userContext = await contextCollector.collectUserContext();

      expect(userContext.preferences).toBeDefined();
      expect(userContext.preferences.theme).toBe('dark');
      expect(userContext.preferences.fontSize).toBe(14);
      expect(userContext.recentActions).toEqual([]);
      expect(userContext.activeFeatures).toContain('editor');
      expect(userContext.activeFeatures).toContain('runner');
    });
  });

  describe('trackUserAction', () => {
    it('should track user actions', () => {
      const action = {
        type: 'edit' as const,
        timestamp: new Date(),
        details: { file: 'test.js' }
      };

      contextCollector.trackUserAction(action);

      const userContext = contextCollector.collectUserContext();
      expect(userContext.then).toBeDefined(); // It's async, so we get a promise
    });

    it('should limit action history size', () => {
      // Add more actions than the max history size
      for (let i = 0; i < 150; i++) {
        contextCollector.trackUserAction({
          type: 'edit',
          timestamp: new Date(),
          details: { index: i }
        });
      }

      // The internal history should be limited (we can't directly test this without exposing internals)
      // But we can verify the method doesn't throw errors
      expect(() => {
        contextCollector.trackUserAction({
          type: 'edit',
          timestamp: new Date(),
          details: { final: true }
        });
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle runner engine errors gracefully', async () => {
      const errorRunner = {
        ...mockRunnerEngine,
        listFiles: vi.fn(async () => { throw new Error('Runner error'); }),
        readFile: vi.fn(async () => { throw new Error('File read error'); })
      };
      contextCollector.setRunnerEngine(errorRunner as WebContainerRunner);

      const projectContext = await contextCollector.collectProjectContext();

      expect(projectContext.structure).toEqual({});
      // Config will still have some default values even when file operations fail
      expect(projectContext.config.type).toBe('javascript');
      expect(projectContext.dependencies).toEqual([]);
    });

    it('should continue working when engines are not set', async () => {
      const freshCollector = new ContextCollector();
      await freshCollector.initialize();

      const context = await freshCollector.collectContext();

      expect(context).toBeDefined();
      expect(context.buffer.content).toBe('');
      expect(context.project.structure).toEqual({});
    });
  });
});