/**
 * Unit tests for CommunicationProtocol
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommunicationProtocol } from './CommunicationProtocol.js';
import { DefaultMCPProvider } from './BaseMCPProvider.js';
import type { MCPContext, MCPAction } from './types.js';

// Mock provider for testing
class MockProvider extends DefaultMCPProvider {
  public shouldFail = false;
  public delay = 0;

  constructor(id: string = 'test-provider') {
    super();
    (this as any).id = id;
  }

  async processContext(context: MCPContext) {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    if (this.shouldFail) {
      throw new Error('Mock processing failed');
    }
    
    return super.processContext(context);
  }

  async executeAction(action: MCPAction, context: MCPContext) {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    
    if (this.shouldFail) {
      throw new Error('Mock execution failed');
    }
    
    return super.executeAction(action, context);
  }
}

describe('CommunicationProtocol', () => {
  let protocol: CommunicationProtocol;
  let mockProvider: MockProvider;
  let mockContext: MCPContext;
  let mockAction: MCPAction;

  beforeEach(() => {
    protocol = new CommunicationProtocol({
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100
    });

    mockProvider = new MockProvider();

    mockContext = {
      id: 'test-context',
      timestamp: new Date(),
      buffer: {
        content: 'test content',
        language: 'javascript',
        cursor: { line: 0, column: 0 },
        modified: false
      },
      project: {
        structure: {},
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
      id: 'test-action',
      type: 'explain',
      target: { type: 'selection' },
      parameters: {},
      timestamp: new Date()
    };
  });

  describe('context processing communication', () => {
    it('should request context processing successfully', async () => {
      const result = await protocol.requestContextProcessing(mockProvider, mockContext);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should handle context processing failures', async () => {
      mockProvider.shouldFail = true;

      await expect(protocol.requestContextProcessing(mockProvider, mockContext))
        .rejects.toThrow('Mock processing failed');
    });

    it('should retry on failures', async () => {
      let attemptCount = 0;
      const originalProcessContext = mockProvider.processContext.bind(mockProvider);
      
      mockProvider.processContext = vi.fn(async (context) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return originalProcessContext(context);
      });

      const result = await protocol.requestContextProcessing(mockProvider, mockContext);

      expect(result).toBeDefined();
      expect(attemptCount).toBe(2);
    });

    it('should pass processing options', async () => {
      const options = {
        includeMetadata: true,
        maxSuggestions: 5,
        analysisDepth: 'deep' as const
      };

      const result = await protocol.requestContextProcessing(mockProvider, mockContext, options);

      expect(result).toBeDefined();
    });
  });

  describe('action execution communication', () => {
    it('should request action execution successfully', async () => {
      const result = await protocol.requestActionExecution(mockProvider, mockAction, mockContext);

      expect(result.success).toBe(true);
    });

    it('should handle action execution failures', async () => {
      mockProvider.shouldFail = true;

      await expect(protocol.requestActionExecution(mockProvider, mockAction, mockContext))
        .rejects.toThrow('Mock execution failed');
    });

    it('should handle dry run mode', async () => {
      const result = await protocol.requestActionExecution(
        mockProvider, 
        mockAction, 
        mockContext, 
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.dryRun).toBe(true);
      expect(result.metadata?.wouldExecute).toBe(true);
    });

    it('should handle validation only mode', async () => {
      const validAction = {
        ...mockAction,
        target: {
          type: 'selection' as const,
          range: {
            from: { line: 0, column: 0 },
            to: { line: 0, column: 10 }
          }
        }
      };

      const result = await protocol.requestActionExecution(
        mockProvider, 
        validAction, 
        mockContext, 
        { validateOnly: true }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.validationOnly).toBe(true);
    });

    it('should validate invalid actions', async () => {
      const invalidAction = {
        ...mockAction,
        id: '', // Invalid - empty ID
        target: { type: 'selection' } // Invalid - missing range
      };

      const result = await protocol.requestActionExecution(
        mockProvider, 
        invalidAction, 
        mockContext, 
        { validateOnly: true }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action ID is required');
      expect(result.error).toContain('Selection target requires range');
    });

    it('should handle timeout', async () => {
      mockProvider.delay = 6000; // Longer than timeout

      await expect(protocol.requestActionExecution(
        mockProvider, 
        mockAction, 
        mockContext, 
        { timeout: 1000 }
      )).rejects.toThrow('Operation timed out');
    });

    it('should retry on failures', async () => {
      let attemptCount = 0;
      const originalExecuteAction = mockProvider.executeAction.bind(mockProvider);
      
      mockProvider.executeAction = vi.fn(async (action, context) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return originalExecuteAction(action, context);
      });

      const result = await protocol.requestActionExecution(mockProvider, mockAction, mockContext);

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });
  });

  describe('health check communication', () => {
    it('should ping provider successfully', async () => {
      const result = await protocol.ping(mockProvider);

      expect(result).toBe(true);
    });

    it('should handle ping failures', async () => {
      mockProvider.shouldFail = true;

      const result = await protocol.ping(mockProvider);

      expect(result).toBe(false);
    });

    it('should timeout on slow providers', async () => {
      mockProvider.delay = 6000; // Longer than ping timeout

      const result = await protocol.ping(mockProvider);

      expect(result).toBe(false);
    }, 10000); // Increase test timeout
  });

  describe('configuration', () => {
    it('should get current configuration', () => {
      const config = protocol.getConfig();

      expect(config.timeout).toBe(5000);
      expect(config.retryAttempts).toBe(2);
      expect(config.retryDelay).toBe(100);
    });

    it('should update configuration', () => {
      protocol.updateConfig({
        timeout: 10000,
        retryAttempts: 5
      });

      const config = protocol.getConfig();

      expect(config.timeout).toBe(10000);
      expect(config.retryAttempts).toBe(5);
      expect(config.retryDelay).toBe(100); // Should remain unchanged
    });
  });

  describe('error handling', () => {
    it('should create proper error responses', async () => {
      mockProvider.shouldFail = true;

      try {
        await protocol.requestContextProcessing(mockProvider, mockContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Mock processing failed');
      }
    });

    it('should handle non-Error exceptions', async () => {
      mockProvider.processContext = vi.fn(async () => {
        throw 'String error'; // Non-Error exception
      });

      try {
        await protocol.requestContextProcessing(mockProvider, mockContext);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // The retry mechanism wraps non-Error exceptions in Error objects
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Unknown error');
      }
    });
  });

  describe('message creation', () => {
    it('should create messages with proper structure', () => {
      // Access private method for testing
      const message = (protocol as any).createMessage('ping', { test: true });

      expect(message.id).toMatch(/^msg_\d+_\d+$/);
      expect(message.type).toBe('ping');
      expect(message.version).toBe('1.0.0');
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.payload).toEqual({ test: true });
      expect(message.metadata?.source).toBe('mcp-client');
    });

    it('should generate unique message IDs', () => {
      const message1 = (protocol as any).createMessage('ping', {});
      const message2 = (protocol as any).createMessage('ping', {});

      expect(message1.id).not.toBe(message2.id);
    });
  });
});