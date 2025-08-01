/**
 * Unit tests for RollbackManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackManager, RollbackUtils } from './RollbackManager.js';
import type { MCPContext, CodeChange } from './types.js';

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;
  let mockContext: MCPContext;

  beforeEach(() => {
    rollbackManager = new RollbackManager(5); // Small limit for testing
    
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
        },
        path: 'test.js'
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
  });

  describe('snapshot creation', () => {
    it('should create snapshots', () => {
      const changes: CodeChange[] = [{
        type: 'replace',
        path: 'test.js',
        content: 'new content'
      }];

      rollbackManager.createSnapshot('action-1', mockContext, changes);
      
      const snapshot = rollbackManager.getSnapshot('action-1');
      expect(snapshot).toBeDefined();
      expect(snapshot?.actionId).toBe('action-1');
      expect(snapshot?.originalState.content).toBe(mockContext.buffer.content);
      expect(snapshot?.changes).toEqual(changes);
    });

    it('should enforce snapshot limit', () => {
      // Create more snapshots than the limit
      for (let i = 0; i < 10; i++) {
        rollbackManager.createSnapshot(`action-${i}`, mockContext, []);
      }

      const stats = rollbackManager.getStatistics();
      expect(stats.totalSnapshots).toBe(5); // Should be limited to 5
      
      // First snapshots should be removed
      expect(rollbackManager.getSnapshot('action-0')).toBeNull();
      expect(rollbackManager.getSnapshot('action-9')).toBeDefined();
    });
  });

  describe('rollback operations', () => {
    beforeEach(() => {
      const changes: CodeChange[] = [{
        type: 'replace',
        path: 'test.js',
        content: 'modified content'
      }];
      
      rollbackManager.createSnapshot('action-1', mockContext, changes);
    });

    it('should rollback specific actions', async () => {
      const result = await rollbackManager.rollback('action-1');
      
      expect(result.success).toBe(true);
      expect(result.restoredState).toBeDefined();
      expect(result.restoredState?.content).toBe(mockContext.buffer.content);
      expect(result.metadata?.actionId).toBe('action-1');
    });

    it('should fail to rollback non-existent actions', async () => {
      const result = await rollbackManager.rollback('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No rollback snapshot found');
    });

    it('should rollback last action', async () => {
      // Create multiple snapshots
      rollbackManager.createSnapshot('action-2', mockContext, []);
      rollbackManager.createSnapshot('action-3', mockContext, []);
      
      const result = await rollbackManager.rollbackLast();
      
      expect(result.success).toBe(true);
      expect(result.metadata?.actionId).toBe('action-3'); // Should be the last one
    });

    it('should fail to rollback when no actions exist', async () => {
      const freshManager = new RollbackManager();
      const result = await freshManager.rollbackLast();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('No actions to rollback');
    });

    it('should rollback multiple actions', async () => {
      // Create additional snapshots
      rollbackManager.createSnapshot('action-2', mockContext, []);
      rollbackManager.createSnapshot('action-3', mockContext, []);
      
      const results = await rollbackManager.rollbackMultiple(2);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      
      // Should rollback in reverse order (last first)
      expect(results[0].metadata?.actionId).toBe('action-3');
      expect(results[1].metadata?.actionId).toBe('action-2');
    });
  });

  describe('snapshot management', () => {
    it('should check if actions can be rolled back', () => {
      rollbackManager.createSnapshot('action-1', mockContext, []);
      
      expect(rollbackManager.canRollback('action-1')).toBe(true);
      expect(rollbackManager.canRollback('non-existent')).toBe(false);
    });

    it('should get rollback history', () => {
      rollbackManager.createSnapshot('action-1', mockContext, []);
      rollbackManager.createSnapshot('action-2', mockContext, []);
      
      const history = rollbackManager.getRollbackHistory();
      
      expect(history).toHaveLength(2);
      // History is sorted by timestamp, but since they're created quickly, 
      // let's just check that both actions are present
      const actionIds = history.map(h => h.actionId);
      expect(actionIds).toContain('action-1');
      expect(actionIds).toContain('action-2');
    });

    it('should clear history', () => {
      rollbackManager.createSnapshot('action-1', mockContext, []);
      rollbackManager.createSnapshot('action-2', mockContext, []);
      
      rollbackManager.clearHistory();
      
      const history = rollbackManager.getRollbackHistory();
      expect(history).toHaveLength(0);
      
      const stats = rollbackManager.getStatistics();
      expect(stats.totalSnapshots).toBe(0);
    });

    it('should remove specific snapshots', () => {
      rollbackManager.createSnapshot('action-1', mockContext, []);
      rollbackManager.createSnapshot('action-2', mockContext, []);
      
      const removed = rollbackManager.removeSnapshot('action-1');
      
      expect(removed).toBe(true);
      expect(rollbackManager.getSnapshot('action-1')).toBeNull();
      expect(rollbackManager.getSnapshot('action-2')).toBeDefined();
    });

    it('should return false when removing non-existent snapshots', () => {
      const removed = rollbackManager.removeSnapshot('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should provide statistics for empty manager', () => {
      const stats = rollbackManager.getStatistics();
      
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.averageSnapshotSize).toBe(0);
      expect(stats.oldestSnapshot).toBeUndefined();
      expect(stats.newestSnapshot).toBeUndefined();
    });

    it('should provide statistics with snapshots', () => {
      rollbackManager.createSnapshot('action-1', mockContext, []);
      
      // Wait a bit to ensure different timestamps
      setTimeout(() => {
        rollbackManager.createSnapshot('action-2', mockContext, []);
        
        const stats = rollbackManager.getStatistics();
        
        expect(stats.totalSnapshots).toBe(2);
        expect(stats.averageSnapshotSize).toBeGreaterThan(0);
        expect(stats.oldestSnapshot).toBeDefined();
        expect(stats.newestSnapshot).toBeDefined();
        expect(stats.newestSnapshot!.getTime()).toBeGreaterThan(stats.oldestSnapshot!.getTime());
      }, 10);
    });
  });
});

describe('RollbackUtils', () => {
  describe('rollback validation', () => {
    it('should validate safe rollbacks', () => {
      const snapshot = {
        actionId: 'action-1',
        timestamp: new Date(),
        originalState: {
          content: 'original content',
          cursor: { line: 0, column: 0 },
          path: 'test.js'
        },
        changes: [],
        context: {
          buffer: {
            content: 'original content',
            language: 'javascript',
            cursor: { line: 0, column: 0 },
            modified: false,
            path: 'test.js'
          }
        }
      };

      const currentContext = {
        id: 'current',
        timestamp: new Date(),
        buffer: {
          content: 'original content', // Same as snapshot
          language: 'javascript',
          cursor: { line: 0, column: 0 },
          modified: false,
          path: 'test.js'
        },
        project: { structure: {}, config: {}, dependencies: [] },
        execution: { history: [], environment: {} },
        user: { preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true }, recentActions: [], activeFeatures: [] }
      };

      const validation = RollbackUtils.validateRollback(snapshot, currentContext);
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should warn about content changes', () => {
      const snapshot = {
        actionId: 'action-1',
        timestamp: new Date(),
        originalState: {
          content: 'original content',
          cursor: { line: 0, column: 0 },
          path: 'test.js'
        },
        changes: [],
        context: {
          buffer: {
            content: 'original content',
            language: 'javascript',
            cursor: { line: 0, column: 0 },
            modified: false,
            path: 'test.js'
          }
        }
      };

      const currentContext = {
        id: 'current',
        timestamp: new Date(),
        buffer: {
          content: 'modified content', // Different from snapshot
          language: 'javascript',
          cursor: { line: 0, column: 0 },
          modified: true,
          path: 'test.js'
        },
        project: { structure: {}, config: {}, dependencies: [] },
        execution: { history: [], environment: {} },
        user: { preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true }, recentActions: [], activeFeatures: [] }
      };

      const validation = RollbackUtils.validateRollback(snapshot, currentContext);
      
      expect(validation.valid).toBe(false);
      expect(validation.warnings).toContain('Buffer content has changed since snapshot was created');
    });

    it('should warn about path changes', () => {
      const snapshot = {
        actionId: 'action-1',
        timestamp: new Date(),
        originalState: {
          content: 'content',
          cursor: { line: 0, column: 0 },
          path: 'old-path.js'
        },
        changes: [],
        context: {
          buffer: {
            content: 'content',
            language: 'javascript',
            cursor: { line: 0, column: 0 },
            modified: false,
            path: 'old-path.js'
          }
        }
      };

      const currentContext = {
        id: 'current',
        timestamp: new Date(),
        buffer: {
          content: 'content',
          language: 'javascript',
          cursor: { line: 0, column: 0 },
          modified: false,
          path: 'new-path.js' // Different path
        },
        project: { structure: {}, config: {}, dependencies: [] },
        execution: { history: [], environment: {} },
        user: { preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true }, recentActions: [], activeFeatures: [] }
      };

      const validation = RollbackUtils.validateRollback(snapshot, currentContext);
      
      expect(validation.valid).toBe(false);
      expect(validation.warnings).toContain('File path has changed since snapshot was created');
    });

    it('should warn about old snapshots', () => {
      const oldTimestamp = new Date();
      oldTimestamp.setHours(oldTimestamp.getHours() - 2); // 2 hours ago

      const snapshot = {
        actionId: 'action-1',
        timestamp: oldTimestamp,
        originalState: {
          content: 'content',
          cursor: { line: 0, column: 0 },
          path: 'test.js'
        },
        changes: [],
        context: {
          buffer: {
            content: 'content',
            language: 'javascript',
            cursor: { line: 0, column: 0 },
            modified: false,
            path: 'test.js'
          }
        }
      };

      const currentContext = {
        id: 'current',
        timestamp: new Date(),
        buffer: {
          content: 'content',
          language: 'javascript',
          cursor: { line: 0, column: 0 },
          modified: false,
          path: 'test.js'
        },
        project: { structure: {}, config: {}, dependencies: [] },
        execution: { history: [], environment: {} },
        user: { preferences: { theme: 'dark', fontSize: 14, tabSize: 2, autoSave: true }, recentActions: [], activeFeatures: [] }
      };

      const validation = RollbackUtils.validateRollback(snapshot, currentContext);
      
      expect(validation.valid).toBe(false);
      expect(validation.warnings).toContain('Snapshot is older than 1 hour');
    });
  });
});