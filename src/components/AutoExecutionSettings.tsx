import React, { useState, useEffect, useCallback } from 'react';
import type { AutoExecutionManager } from '../../core/runner/auto-execution/AutoExecutionManager.js';
import type { ExecutionStrategy, AutoExecutionConfig } from '../../core/runner/auto-execution/types.js';
import './AutoExecutionSettings.css';

export interface AutoExecutionSettingsProps {
  autoExecutionManager: AutoExecutionManager | null;
  onClose?: () => void;
  className?: string;
}

interface SettingsState {
  enabled: boolean;
  strategy: ExecutionStrategy;
  debounceDelay: number;
  watchPatterns: string[];
  ignorePatterns: string[];
  maxRetries: number;
  maxQueueSize: number;
}

const DEFAULT_SETTINGS: SettingsState = {
  enabled: false,
  strategy: {
    type: 'debounced',
    delay: 1000,
    priority: 'speed',
    batchSize: 5,
    batchWindow: 2000,
    dependencyResolution: true
  },
  debounceDelay: 1000,
  watchPatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  maxRetries: 3,
  maxQueueSize: 50
};

export const AutoExecutionSettings: React.FC<AutoExecutionSettingsProps> = ({
  autoExecutionManager,
  onClose,
  className = ''
}) => {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [newWatchPattern, setNewWatchPattern] = useState('');
  const [newIgnorePattern, setNewIgnorePattern] = useState('');

  // Load current settings
  useEffect(() => {
    if (!autoExecutionManager) return;

    // Note: In a real implementation, we'd need methods to get current config
    // For now, we'll use the defaults and track changes
    setSettings({
      enabled: autoExecutionManager.isEnabled(),
      strategy: {
        type: 'debounced',
        delay: 1000,
        priority: 'speed',
        batchSize: 5,
        batchWindow: 2000,
        dependencyResolution: true
      },
      debounceDelay: 1000,
      watchPatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
      ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      maxRetries: 3,
      maxQueueSize: 50
    });
  }, [autoExecutionManager]);

  const handleSettingChange = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const handleStrategyChange = useCallback(<K extends keyof ExecutionStrategy>(
    key: K,
    value: ExecutionStrategy[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      strategy: { ...prev.strategy, [key]: value }
    }));
    setHasChanges(true);
  }, []);

  const handleAddWatchPattern = useCallback(() => {
    if (!newWatchPattern.trim()) return;
    
    setSettings(prev => ({
      ...prev,
      watchPatterns: [...prev.watchPatterns, newWatchPattern.trim()]
    }));
    setNewWatchPattern('');
    setHasChanges(true);
  }, [newWatchPattern]);

  const handleRemoveWatchPattern = useCallback((index: number) => {
    setSettings(prev => ({
      ...prev,
      watchPatterns: prev.watchPatterns.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  }, []);

  const handleAddIgnorePattern = useCallback(() => {
    if (!newIgnorePattern.trim()) return;
    
    setSettings(prev => ({
      ...prev,
      ignorePatterns: [...prev.ignorePatterns, newIgnorePattern.trim()]
    }));
    setNewIgnorePattern('');
    setHasChanges(true);
  }, [newIgnorePattern]);

  const handleRemoveIgnorePattern = useCallback((index: number) => {
    setSettings(prev => ({
      ...prev,
      ignorePatterns: prev.ignorePatterns.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!autoExecutionManager) return;

    // Apply settings to AutoExecutionManager
    if (settings.enabled) {
      autoExecutionManager.enable();
    } else {
      autoExecutionManager.disable();
    }

    autoExecutionManager.setExecutionStrategy(settings.strategy);
    autoExecutionManager.setDebounceDelay(settings.debounceDelay);

    // Note: In a real implementation, we'd need methods to set watch patterns,
    // ignore patterns, max retries, and max queue size

    setHasChanges(false);
    console.log('Auto-execution settings saved:', settings);
  }, [autoExecutionManager, settings]);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
  }, []);

  const handleCancel = useCallback(() => {
    setHasChanges(false);
    onClose?.();
  }, [onClose]);

  if (!autoExecutionManager) {
    return (
      <div className={`auto-execution-settings auto-execution-settings--disabled ${className}`}>
        <div className="settings-header">
          <h3>Auto-Execution Settings</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="settings-content">
          <p>Auto-execution manager not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`auto-execution-settings ${className}`}>
      {/* Header */}
      <div className="settings-header">
        <h3>Auto-Execution Settings</h3>
        <button className="close-btn" onClick={onClose} title="Close settings">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="settings-content">
        {/* General Settings */}
        <div className="settings-section">
          <h4 className="section-title">General</h4>
          
          <div className="setting-item">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleSettingChange('enabled', e.target.checked)}
              />
              <span>Enable auto-execution</span>
            </label>
            <p className="setting-description">
              Automatically execute code when files change
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">Debounce Delay (ms)</label>
            <input
              type="number"
              className="setting-input"
              min="100"
              max="10000"
              step="100"
              value={settings.debounceDelay}
              onChange={(e) => handleSettingChange('debounceDelay', parseInt(e.target.value) || 1000)}
            />
            <p className="setting-description">
              Delay before executing after file changes
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">Max Retries</label>
            <input
              type="number"
              className="setting-input"
              min="0"
              max="10"
              value={settings.maxRetries}
              onChange={(e) => handleSettingChange('maxRetries', parseInt(e.target.value) || 3)}
            />
            <p className="setting-description">
              Maximum number of retry attempts for failed executions
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">Max Queue Size</label>
            <input
              type="number"
              className="setting-input"
              min="1"
              max="100"
              value={settings.maxQueueSize}
              onChange={(e) => handleSettingChange('maxQueueSize', parseInt(e.target.value) || 50)}
            />
            <p className="setting-description">
              Maximum number of files that can be queued for execution
            </p>
          </div>
        </div>

        {/* Strategy Settings */}
        <div className="settings-section">
          <h4 className="section-title">Execution Strategy</h4>
          
          <div className="setting-item">
            <label className="setting-label">Strategy Type</label>
            <select
              className="setting-select"
              value={settings.strategy.type}
              onChange={(e) => handleStrategyChange('type', e.target.value as ExecutionStrategy['type'])}
            >
              <option value="immediate">Immediate</option>
              <option value="debounced">Debounced</option>
              <option value="batch">Batch</option>
              <option value="manual">Manual</option>
            </select>
            <p className="setting-description">
              How to handle file changes and execution timing
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">Priority</label>
            <div className="setting-radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="priority"
                  value="speed"
                  checked={settings.strategy.priority === 'speed'}
                  onChange={() => handleStrategyChange('priority', 'speed')}
                />
                <span>Speed</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="priority"
                  value="accuracy"
                  checked={settings.strategy.priority === 'accuracy'}
                  onChange={() => handleStrategyChange('priority', 'accuracy')}
                />
                <span>Accuracy</span>
              </label>
            </div>
            <p className="setting-description">
              Optimize for execution speed or accuracy
            </p>
          </div>

          {settings.strategy.type === 'batch' && (
            <>
              <div className="setting-item">
                <label className="setting-label">Batch Size</label>
                <input
                  type="number"
                  className="setting-input"
                  min="1"
                  max="20"
                  value={settings.strategy.batchSize || 5}
                  onChange={(e) => handleStrategyChange('batchSize', parseInt(e.target.value) || 5)}
                />
                <p className="setting-description">
                  Maximum number of files to process in a single batch
                </p>
              </div>

              <div className="setting-item">
                <label className="setting-label">Batch Window (ms)</label>
                <input
                  type="number"
                  className="setting-input"
                  min="500"
                  max="10000"
                  step="500"
                  value={settings.strategy.batchWindow || 2000}
                  onChange={(e) => handleStrategyChange('batchWindow', parseInt(e.target.value) || 2000)}
                />
                <p className="setting-description">
                  Time window to collect files for batch processing
                </p>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <input
                    type="checkbox"
                    checked={settings.strategy.dependencyResolution || false}
                    onChange={(e) => handleStrategyChange('dependencyResolution', e.target.checked)}
                  />
                  <span>Dependency Resolution</span>
                </label>
                <p className="setting-description">
                  Execute files in dependency order within batches
                </p>
              </div>
            </>
          )}
        </div>

        {/* Watch Patterns */}
        <div className="settings-section">
          <h4 className="section-title">Watch Patterns</h4>
          
          <div className="pattern-list">
            {settings.watchPatterns.map((pattern, index) => (
              <div key={index} className="pattern-item">
                <code className="pattern-code">{pattern}</code>
                <button
                  className="pattern-remove-btn"
                  onClick={() => handleRemoveWatchPattern(index)}
                  title="Remove pattern"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          <div className="pattern-add">
            <input
              type="text"
              className="pattern-input"
              placeholder="e.g., **/*.js"
              value={newWatchPattern}
              onChange={(e) => setNewWatchPattern(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddWatchPattern()}
            />
            <button
              className="pattern-add-btn"
              onClick={handleAddWatchPattern}
              disabled={!newWatchPattern.trim()}
            >
              Add
            </button>
          </div>
          <p className="setting-description">
            File patterns to watch for changes (glob patterns supported)
          </p>
        </div>

        {/* Ignore Patterns */}
        <div className="settings-section">
          <h4 className="section-title">Ignore Patterns</h4>
          
          <div className="pattern-list">
            {settings.ignorePatterns.map((pattern, index) => (
              <div key={index} className="pattern-item">
                <code className="pattern-code">{pattern}</code>
                <button
                  className="pattern-remove-btn"
                  onClick={() => handleRemoveIgnorePattern(index)}
                  title="Remove pattern"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          <div className="pattern-add">
            <input
              type="text"
              className="pattern-input"
              placeholder="e.g., **/node_modules/**"
              value={newIgnorePattern}
              onChange={(e) => setNewIgnorePattern(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddIgnorePattern()}
            />
            <button
              className="pattern-add-btn"
              onClick={handleAddIgnorePattern}
              disabled={!newIgnorePattern.trim()}
            >
              Add
            </button>
          </div>
          <p className="setting-description">
            File patterns to ignore (glob patterns supported)
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="settings-footer">
        <div className="settings-actions">
          <button
            className="settings-btn settings-btn--secondary"
            onClick={handleReset}
          >
            Reset to Defaults
          </button>
          <div className="settings-actions-right">
            <button
              className="settings-btn settings-btn--secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className="settings-btn settings-btn--primary"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Changes
            </button>
          </div>
        </div>
        
        {hasChanges && (
          <div className="settings-status">
            <span className="status-indicator">●</span>
            <span>You have unsaved changes</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutoExecutionSettings;