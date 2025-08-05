import React, { useState, useEffect, useCallback } from 'react';
import type { AutoExecutionManager } from '../../core/runner/auto-execution/AutoExecutionManager.js';
import type { ExecutionStatus, ExecutionStrategy, ExecutionProgress } from '../../core/runner/auto-execution/types.js';
import './AutoExecutionPanel.css';

export interface AutoExecutionPanelProps {
  autoExecutionManager: AutoExecutionManager | null;
  className?: string;
}

export const AutoExecutionPanel: React.FC<AutoExecutionPanelProps> = ({
  autoExecutionManager,
  className = ''
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<ExecutionStatus>({
    isRunning: false,
    queuedFiles: [],
    executionCount: 0
  });
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  const [strategy, setStrategy] = useState<ExecutionStrategy>({
    type: 'debounced',
    delay: 1000,
    priority: 'speed'
  });
  const [debounceDelay, setDebounceDelay] = useState(1000);

  // Update status periodically
  useEffect(() => {
    if (!autoExecutionManager) return;

    const updateStatus = () => {
      setIsEnabled(autoExecutionManager.isEnabled());
      setStatus(autoExecutionManager.getExecutionStatus());
    };

    // Initial update
    updateStatus();

    // Set up periodic updates
    const interval = setInterval(updateStatus, 500);

    return () => clearInterval(interval);
  }, [autoExecutionManager]);

  // Set up progress tracking
  useEffect(() => {
    if (!autoExecutionManager) return;

    const handleProgress = (progressData: ExecutionProgress) => {
      setProgress(progressData);
    };

    autoExecutionManager.onProgress(handleProgress);

    return () => {
      // Note: In a real implementation, we'd need a way to remove the callback
      // For now, we'll rely on component unmounting
    };
  }, [autoExecutionManager]);

  const handleToggleEnabled = useCallback(() => {
    if (!autoExecutionManager) return;

    if (isEnabled) {
      autoExecutionManager.disable();
    } else {
      autoExecutionManager.enable();
    }
  }, [autoExecutionManager, isEnabled]);

  const handleStrategyChange = useCallback((newStrategy: ExecutionStrategy['type']) => {
    if (!autoExecutionManager) return;

    const updatedStrategy: ExecutionStrategy = {
      ...strategy,
      type: newStrategy
    };
    
    setStrategy(updatedStrategy);
    autoExecutionManager.setExecutionStrategy(updatedStrategy);
  }, [autoExecutionManager, strategy]);

  const handleDelayChange = useCallback((newDelay: number) => {
    if (!autoExecutionManager) return;

    setDebounceDelay(newDelay);
    autoExecutionManager.setDebounceDelay(newDelay);
    
    // Also update strategy delay
    const updatedStrategy: ExecutionStrategy = {
      ...strategy,
      delay: newDelay
    };
    setStrategy(updatedStrategy);
    autoExecutionManager.setExecutionStrategy(updatedStrategy);
  }, [autoExecutionManager, strategy]);

  const handleCancelExecution = useCallback(() => {
    if (!autoExecutionManager) return;
    autoExecutionManager.cancelExecution();
  }, [autoExecutionManager]);

  const handleExecuteNow = useCallback(async () => {
    if (!autoExecutionManager) return;
    
    try {
      await autoExecutionManager.executeNow();
    } catch (error) {
      console.error('Manual execution failed:', error);
    }
  }, [autoExecutionManager]);

  if (!autoExecutionManager) {
    return (
      <div className={`auto-execution-panel auto-execution-panel--disabled ${className}`}>
        <div className="auto-execution-panel__status">
          <span className="status-icon">⚠️</span>
          <span>Auto-execution not available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`auto-execution-panel ${className}`}>
      {/* Main Toggle */}
      <div className="auto-execution-panel__header">
        <div className="auto-execution-panel__toggle">
          <button
            className={`toggle-btn ${isEnabled ? 'toggle-btn--enabled' : 'toggle-btn--disabled'}`}
            onClick={handleToggleEnabled}
            title={isEnabled ? 'Disable auto-execution' : 'Enable auto-execution'}
          >
            <span className="toggle-icon">{isEnabled ? '⏸️' : '▶️'}</span>
            <span className="toggle-text">
              Auto-execution {isEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Status Indicator */}
        <div className="auto-execution-panel__status">
          <span className={`status-dot ${status.isRunning ? 'status-dot--running' : 'status-dot--idle'}`}></span>
          <span className="status-text">
            {status.isRunning ? 'Running' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Configuration Section */}
      {isEnabled && (
        <div className="auto-execution-panel__config">
          {/* Strategy Selection */}
          <div className="config-group">
            <label className="config-label">Execution Strategy:</label>
            <select
              className="config-select"
              value={strategy.type}
              onChange={(e) => handleStrategyChange(e.target.value as ExecutionStrategy['type'])}
            >
              <option value="immediate">Immediate</option>
              <option value="debounced">Debounced</option>
              <option value="batch">Batch</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Delay Configuration */}
          {(strategy.type === 'debounced' || strategy.type === 'batch') && (
            <div className="config-group">
              <label className="config-label">
                Delay: {debounceDelay}ms
              </label>
              <input
                type="range"
                className="config-slider"
                min="100"
                max="5000"
                step="100"
                value={debounceDelay}
                onChange={(e) => handleDelayChange(parseInt(e.target.value))}
              />
              <div className="config-range-labels">
                <span>100ms</span>
                <span>5s</span>
              </div>
            </div>
          )}

          {/* Priority Selection */}
          <div className="config-group">
            <label className="config-label">Priority:</label>
            <div className="config-radio-group">
              <label className="config-radio">
                <input
                  type="radio"
                  name="priority"
                  value="speed"
                  checked={strategy.priority === 'speed'}
                  onChange={() => setStrategy({ ...strategy, priority: 'speed' })}
                />
                <span>Speed</span>
              </label>
              <label className="config-radio">
                <input
                  type="radio"
                  name="priority"
                  value="accuracy"
                  checked={strategy.priority === 'accuracy'}
                  onChange={() => setStrategy({ ...strategy, priority: 'accuracy' })}
                />
                <span>Accuracy</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Execution Status */}
      <div className="auto-execution-panel__execution-status">
        {/* Queue Information */}
        <div className="execution-info">
          <div className="execution-info__item">
            <span className="info-label">Queue:</span>
            <span className="info-value">{status.queuedFiles.length} files</span>
          </div>
          <div className="execution-info__item">
            <span className="info-label">Total runs:</span>
            <span className="info-value">{status.executionCount}</span>
          </div>
          {status.lastExecution && (
            <div className="execution-info__item">
              <span className="info-label">Last run:</span>
              <span className="info-value">
                {new Date(status.lastExecution).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Current Execution */}
        {status.currentFile && (
          <div className="current-execution">
            <div className="current-execution__file">
              <span className="file-icon">📄</span>
              <span className="file-name">{status.currentFile}</span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {progress && progress.stage !== 'completed' && progress.stage !== 'cancelled' && (
          <div className="execution-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar__fill"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <div className="progress-info">
              <span className="progress-text">
                {progress.message || `${progress.current}/${progress.total}`}
              </span>
              {progress.estimatedTimeRemaining && (
                <span className="progress-time">
                  ~{Math.round(progress.estimatedTimeRemaining / 1000)}s
                </span>
              )}
            </div>
          </div>
        )}

        {/* Queued Files */}
        {status.queuedFiles.length > 0 && (
          <div className="queued-files">
            <div className="queued-files__header">
              <span className="queued-files__title">Queued Files:</span>
            </div>
            <div className="queued-files__list">
              {status.queuedFiles.slice(0, 5).map((file, index) => (
                <div key={index} className="queued-file">
                  <span className="queued-file__icon">⏳</span>
                  <span className="queued-file__name">{file}</span>
                </div>
              ))}
              {status.queuedFiles.length > 5 && (
                <div className="queued-file queued-file--more">
                  <span className="queued-file__icon">⋯</span>
                  <span className="queued-file__name">
                    +{status.queuedFiles.length - 5} more
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="auto-execution-panel__actions">
        <button
          className="action-btn action-btn--execute"
          onClick={handleExecuteNow}
          disabled={status.isRunning}
          title="Execute current file now"
        >
          <span className="btn-icon">⚡</span>
          <span className="btn-text">Execute Now</span>
        </button>
        
        {status.isRunning && (
          <button
            className="action-btn action-btn--cancel"
            onClick={handleCancelExecution}
            title="Cancel current execution"
          >
            <span className="btn-icon">⏹️</span>
            <span className="btn-text">Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AutoExecutionPanel;