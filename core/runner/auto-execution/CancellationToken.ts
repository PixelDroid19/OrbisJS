/**
 * CancellationToken - Manages execution cancellation
 */

import type { CancellationToken } from './types.js';

/**
 * Simple cancellation token implementation
 */
export class SimpleCancellationToken implements CancellationToken {
  private _isCancelled = false;
  private _callbacks: (() => void)[] = [];

  get isCancelled(): boolean {
    return this._isCancelled;
  }

  cancel(): void {
    if (!this._isCancelled) {
      this._isCancelled = true;
      this._callbacks.forEach(callback => callback());
      this._callbacks = [];
    }
  }

  onCancelled(callback: () => void): void {
    if (this._isCancelled) {
      callback();
    } else {
      this._callbacks.push(callback);
    }
  }
}