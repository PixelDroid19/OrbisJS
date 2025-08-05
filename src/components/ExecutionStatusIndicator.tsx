import React from 'react';
import type { ExecutionStatus, ExecutionProgress } from '../../core/runner/auto-execution/types.js';
import './ExecutionStatusIndicator.css';

export interface ExecutionStatusIndicatorProps {
  status: ExecutionStatus;
  progress?: ExecutionProgress | null;
  isEnabled: boolean;
  className?: string;
  compact?: boolean;
}

export const ExecutionStatusIndicator: React.FC<ExecutionStatusIndicatorProps> = ({
  status,
  progress,
  isEnabled,
  className = '',
  compact = false
}) => {
  const getStatusIcon = () => {
    if (!isEnabled) return '⏸️';
    if (status.isRunning) return '🔄';
    if (status.queuedFiles.length > 0) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (!isEnabled) return 'Auto-execution disabled';
    if (status.isRunning) {
      if (status.currentFile) {
        return `Executing ${status.currentFile}`;
      }
      return 'Executing...';
    }
    if (status.queuedFiles.length > 0) {
      return `${status.queuedFiles.length} file${status.queuedFiles.length !== 1 ? 's' : ''} queued`;
    }
    return 'Ready';
  };

  const getStatusClass = () => {
    if (!isEnabled) return 'status--disabled';
    if (status.isRunning) return 'status--running';
    if (status.queuedFiles.length > 0) return 'status--queued';
    return 'status--ready';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  if (compact) {
    return (
      <div className={`execution-status-indicator execution-status-indicator--compact ${getStatusClass()} ${className}`}>
        <span className="status-icon" title={getStatusText()}>
          {getStatusIcon()}
        </span>
        {status.isRunning && progress && (
          <div className="compact-progress">
            <div 
              className="compact-progress-bar"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`execution-status-indicator ${getStatusClass()} ${className}`}>
      {/* Main Status */}
      <div className="status-main">
        <span className="status-icon">{getStatusIcon()}</span>
        <div className="status-info">
          <div className="status-text">{getStatusText()}</div>
          {status.lastExecution && (
            <div className="status-subtitle">
              Last run: {formatTime(status.lastExecution)}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {status.isRunning && progress && progress.stage !== 'completed' && progress.stage !== 'cancelled' && (
        <div className="status-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="progress-details">
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

      {/* Queue Info */}
      {status.queuedFiles.length > 0 && !status.isRunning && (
        <div className="status-queue">
          <div className="queue-header">
            <span className="queue-title">Queued:</span>
            <span className="queue-count">{status.queuedFiles.length}</span>
          </div>
          <div className="queue-files">
            {status.queuedFiles.slice(0, 3).map((file, index) => (
              <div key={index} className="queue-file">
                <span className="queue-file-icon">📄</span>
                <span className="queue-file-name">{file}</span>
              </div>
            ))}
            {status.queuedFiles.length > 3 && (
              <div className="queue-file queue-file--more">
                <span className="queue-file-icon">⋯</span>
                <span className="queue-file-name">
                  +{status.queuedFiles.length - 3} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="status-stats">
        <div className="stat-item">
          <span className="stat-label">Total runs:</span>
          <span className="stat-value">{status.executionCount}</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionStatusIndicator;