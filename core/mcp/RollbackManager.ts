/**
 * Rollback Manager - Handles action rollback and undo functionality
 * Provides comprehensive rollback capabilities with state management
 */

import type {
  MCPActionId,
  MCPContext,
  CodeChange
} from './types.js';

export interface RollbackSnapshot {
  actionId: MCPActionId;
  timestamp: Date;
  originalState: BufferState;
  changes: CodeChange[];
  context: Partial<MCPContext>;
}

export interface BufferState {
  content: string;
  selection?: {
    from: { line: number; column: number };
    to: { line: number; column: number };
    text?: string;
  };
  cursor: { line: number; column: number };
  path?: string;
}

export interface RollbackResult {
  success: boolean;
  restoredState?: BufferState;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class RollbackManager {
  private snapshots: Map<MCPActionId, RollbackSnapshot> = new Map();
  private maxSnapshots: number;
  private rollbackStack: MCPActionId[] = [];

  constructor(maxSnapshots: number = 50) {
    this.maxSnapshots = maxSnapshots;
  }

  // Create a rollback snapshot before action execution
  createSnapshot(
    actionId: MCPActionId,
    context: MCPContext,
    plannedChanges: CodeChange[]
  ): void {
    const snapshot: RollbackSnapshot = {
      actionId,
      timestamp: new Date(),
      originalState: this.captureBufferState(context),
      changes: [...plannedChanges], // Deep copy
      context: {
        buffer: { ...context.buffer },
        project: { ...context.project }
      }
    };

    this.snapshots.set(actionId, snapshot);
    this.rollbackStack.push(actionId);

    // Maintain snapshot limit
    this.enforceSnapshotLimit();
  }

  // Update a snapshot with actual changes after execution
  updateSnapshot(actionId: MCPActionId, actualChanges: CodeChange[]): void {
    const snapshot = this.snapshots.get(actionId);
    if (snapshot) {
      snapshot.changes = [...actualChanges]; // Update with actual changes
    }
  }

  // Rollback a specific action
  async rollback(actionId: MCPActionId): Promise<RollbackResult> {
    const snapshot = this.snapshots.get(actionId);
    if (!snapshot) {
      return {
        success: false,
        error: `No rollback snapshot found for action: ${actionId}`
      };
    }

    try {
      // Restore the original state
      const restoredState = await this.restoreBufferState(snapshot.originalState);
      
      // Remove from rollback stack
      const stackIndex = this.rollbackStack.indexOf(actionId);
      if (stackIndex !== -1) {
        this.rollbackStack.splice(stackIndex, 1);
      }

      return {
        success: true,
        restoredState,
        metadata: {
          actionId,
          rollbackTimestamp: new Date(),
          originalTimestamp: snapshot.timestamp,
          changesReverted: snapshot.changes.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Rollback the last action
  async rollbackLast(): Promise<RollbackResult> {
    if (this.rollbackStack.length === 0) {
      return {
        success: false,
        error: 'No actions to rollback'
      };
    }

    const lastActionId = this.rollbackStack[this.rollbackStack.length - 1];
    return this.rollback(lastActionId);
  }

  // Rollback multiple actions in reverse order
  async rollbackMultiple(count: number): Promise<RollbackResult[]> {
    const results: RollbackResult[] = [];
    const actionsToRollback = this.rollbackStack.slice(-count).reverse();

    for (const actionId of actionsToRollback) {
      const result = await this.rollback(actionId);
      results.push(result);
      
      // Stop if any rollback fails
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  // Check if an action can be rolled back
  canRollback(actionId: MCPActionId): boolean {
    return this.snapshots.has(actionId);
  }

  // Get rollback history
  getRollbackHistory(): RollbackSnapshot[] {
    return this.rollbackStack
      .map(id => this.snapshots.get(id))
      .filter((snapshot): snapshot is RollbackSnapshot => snapshot !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Clear rollback history
  clearHistory(): void {
    this.snapshots.clear();
    this.rollbackStack = [];
  }

  // Get snapshot for an action
  getSnapshot(actionId: MCPActionId): RollbackSnapshot | null {
    return this.snapshots.get(actionId) || null;
  }

  // Remove a specific snapshot
  removeSnapshot(actionId: MCPActionId): boolean {
    const removed = this.snapshots.delete(actionId);
    if (removed) {
      const stackIndex = this.rollbackStack.indexOf(actionId);
      if (stackIndex !== -1) {
        this.rollbackStack.splice(stackIndex, 1);
      }
    }
    return removed;
  }

  // Get rollback statistics
  getStatistics(): {
    totalSnapshots: number;
    oldestSnapshot?: Date;
    newestSnapshot?: Date;
    averageSnapshotSize: number;
  } {
    const snapshots = Array.from(this.snapshots.values());
    
    if (snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        averageSnapshotSize: 0
      };
    }

    const timestamps = snapshots.map(s => s.timestamp);
    const sizes = snapshots.map(s => this.calculateSnapshotSize(s));

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      newestSnapshot: new Date(Math.max(...timestamps.map(t => t.getTime()))),
      averageSnapshotSize: sizes.reduce((sum, size) => sum + size, 0) / sizes.length
    };
  }

  // Private methods
  private captureBufferState(context: MCPContext): BufferState {
    return {
      content: context.buffer.content,
      selection: context.buffer.selection ? {
        from: { ...context.buffer.selection.from },
        to: { ...context.buffer.selection.to },
        text: context.buffer.selection.text
      } : undefined,
      cursor: { ...context.buffer.cursor },
      path: context.buffer.path
    };
  }

  private async restoreBufferState(state: BufferState): Promise<BufferState> {
    // In a real implementation, this would interact with the editor engine
    // to restore the buffer state. For now, we'll return the state as-is
    // to indicate what should be restored.
    
    return {
      content: state.content,
      selection: state.selection ? {
        from: { ...state.selection.from },
        to: { ...state.selection.to },
        text: state.selection.text
      } : undefined,
      cursor: { ...state.cursor },
      path: state.path
    };
  }

  private enforceSnapshotLimit(): void {
    while (this.snapshots.size > this.maxSnapshots) {
      // Remove the oldest snapshot
      const oldestActionId = this.rollbackStack.shift();
      if (oldestActionId) {
        this.snapshots.delete(oldestActionId);
      }
    }
  }

  private calculateSnapshotSize(snapshot: RollbackSnapshot): number {
    // Rough calculation of snapshot size in bytes
    const stateSize = JSON.stringify(snapshot.originalState).length;
    const changesSize = JSON.stringify(snapshot.changes).length;
    const contextSize = JSON.stringify(snapshot.context).length;
    
    return stateSize + changesSize + contextSize;
  }
}

// Utility functions for rollback operations
export class RollbackUtils {
  // Apply reverse changes to restore original state
  static applyReverseChanges(content: string, changes: CodeChange[]): string {
    let result = content;
    
    // Apply changes in reverse order
    for (const change of changes.reverse()) {
      result = this.applyReverseChange(result, change);
    }
    
    return result;
  }

  // Apply a single reverse change
  private static applyReverseChange(content: string, change: CodeChange): string {
    switch (change.type) {
      case 'insert':
        // Reverse of insert is delete
        return this.deleteText(content, change.range, change.content || '');
      
      case 'replace':
        // Reverse of replace is replace back (would need original content)
        return content; // In real implementation, we'd store original content
      
      case 'delete':
        // Reverse of delete is insert
        return this.insertText(content, change.range, change.content || '');
      
      default:
        return content;
    }
  }

  // Insert text at a specific range
  private static insertText(
    content: string,
    range: any,
    text: string
  ): string {
    if (!range) return content;
    
    const lines = content.split('\n');
    const { from } = range;
    
    if (from.line < lines.length) {
      const line = lines[from.line];
      const before = line.substring(0, from.column);
      const after = line.substring(from.column);
      lines[from.line] = before + text + after;
    }
    
    return lines.join('\n');
  }

  // Delete text at a specific range
  private static deleteText(
    content: string,
    range: unknown,
    textToDelete: string
  ): string {
    if (!range) return content;
    
    const lines = content.split('\n');
    const { from, to } = range;
    
    if (from.line === to.line && from.line < lines.length) {
      const line = lines[from.line];
      const before = line.substring(0, from.column);
      const after = line.substring(to.column);
      lines[from.line] = before + after;
    }
    
    return lines.join('\n');
  }

  // Validate that a rollback is safe to perform
  static validateRollback(
    snapshot: RollbackSnapshot,
    currentContext: MCPContext
  ): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check if the file has been modified since the snapshot
    if (snapshot.context.buffer?.content !== currentContext.buffer.content) {
      warnings.push('Buffer content has changed since snapshot was created');
    }
    
    // Check if the file path has changed
    if (snapshot.originalState.path !== currentContext.buffer.path) {
      warnings.push('File path has changed since snapshot was created');
    }
    
    // Check snapshot age
    const ageInMinutes = (Date.now() - snapshot.timestamp.getTime()) / (1000 * 60);
    if (ageInMinutes > 60) {
      warnings.push('Snapshot is older than 1 hour');
    }
    
    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}