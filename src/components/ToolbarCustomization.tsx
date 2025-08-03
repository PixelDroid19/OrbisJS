import React, { useState } from 'react';
import type { ToolbarContext, ToolbarItem } from './FloatingToolbar';
import type { ToolbarConfig } from '../types/toolbar';
import { useToolbarCustomization } from '../hooks/useToolbarCustomization';
import './ToolbarCustomization.css';

export interface ToolbarCustomizationProps {
  context: ToolbarContext;
  onClose: () => void;
  className?: string;
}

export const ToolbarCustomization: React.FC<ToolbarCustomizationProps> = ({
  context,
  onClose,
  className = ''
}) => {
  const {
    isLoaded,
    currentConfig,
    availableConfigs,
    dragDropState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    toggleToolVisibility,
    updateTool,
    resetCustomizations,
    exportConfigs,
    importConfigs
  } = useToolbarCustomization(context);

  const [activeTab, setActiveTab] = useState<'tools' | 'configs' | 'import-export'>('tools');
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [toolEdits, setToolEdits] = useState<Partial<ToolbarItem>>({});

  if (!isLoaded || !currentConfig) {
    return (
      <div className={`toolbar-customization ${className}`}>
        <div className="toolbar-customization__loading">
          Loading customization options...
        </div>
      </div>
    );
  }

  const handleToolEdit = (toolId: string, field: keyof ToolbarItem, value: any) => {
    setToolEdits(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveToolEdits = async () => {
    if (!editingTool) return;

    try {
      await updateTool(editingTool, toolEdits);
      setEditingTool(null);
      setToolEdits({});
    } catch (error) {
      console.error('Failed to save tool edits:', error);
    }
  };

  const cancelToolEdits = () => {
    setEditingTool(null);
    setToolEdits({});
  };

  const startEditingTool = (tool: ToolbarItem) => {
    setEditingTool(tool.id);
    setToolEdits({
      icon: tool.icon,
      label: tool.label,
      shortcut: tool.shortcut,
      group: tool.group,
      tooltip: tool.tooltip
    });
  };

  const handleExport = () => {
    const data = exportConfigs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbisjs-toolbar-configs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as string;
        await importConfigs(data);
        alert('Configurations imported successfully!');
      } catch (error) {
        alert(`Failed to import configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`toolbar-customization ${className}`}>
      <div className="toolbar-customization__header">
        <h3>Customize Toolbar</h3>
        <button 
          className="toolbar-customization__close"
          onClick={onClose}
          aria-label="Close customization panel"
        >
          ✕
        </button>
      </div>

      <div className="toolbar-customization__context">
        <span className="toolbar-customization__context-label">Context:</span>
        <span className="toolbar-customization__context-value">
          {context.fileType} 
          {context.hasSelection && ' (with selection)'}
          {context.isReadOnly && ' (read-only)'}
        </span>
      </div>

      <div className="toolbar-customization__tabs">
        <button
          className={`toolbar-customization__tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          Tools
        </button>
        <button
          className={`toolbar-customization__tab ${activeTab === 'configs' ? 'active' : ''}`}
          onClick={() => setActiveTab('configs')}
        >
          Configurations
        </button>
        <button
          className={`toolbar-customization__tab ${activeTab === 'import-export' ? 'active' : ''}`}
          onClick={() => setActiveTab('import-export')}
        >
          Import/Export
        </button>
      </div>

      <div className="toolbar-customization__content">
        {activeTab === 'tools' && (
          <div className="toolbar-customization__tools">
            <div className="toolbar-customization__section-header">
              <h4>Toolbar Tools</h4>
              <button
                className="toolbar-customization__reset"
                onClick={resetCustomizations}
                title="Reset to defaults"
              >
                Reset
              </button>
            </div>

            <div className="toolbar-customization__tools-list">
              {currentConfig.tools.map((tool, index) => (
                <div
                  key={tool.id}
                  className={`toolbar-customization__tool ${
                    dragDropState.draggedItemId === tool.id ? 'dragging' : ''
                  } ${
                    dragDropState.dragOverItemId === tool.id ? 'drag-over' : ''
                  } ${
                    !tool.visible ? 'hidden' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(tool.id, e)}
                  onDragOver={(e) => handleDragOver(tool.id, e)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(tool.id, e)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="toolbar-customization__tool-drag-handle">
                    ⋮⋮
                  </div>

                  <div className="toolbar-customization__tool-info">
                    {editingTool === tool.id ? (
                      <div className="toolbar-customization__tool-edit">
                        <input
                          type="text"
                          value={toolEdits.icon || ''}
                          onChange={(e) => handleToolEdit(tool.id, 'icon', e.target.value)}
                          placeholder="Icon"
                          className="toolbar-customization__tool-input"
                        />
                        <input
                          type="text"
                          value={toolEdits.label || ''}
                          onChange={(e) => handleToolEdit(tool.id, 'label', e.target.value)}
                          placeholder="Label"
                          className="toolbar-customization__tool-input"
                        />
                        <input
                          type="text"
                          value={toolEdits.shortcut || ''}
                          onChange={(e) => handleToolEdit(tool.id, 'shortcut', e.target.value)}
                          placeholder="Shortcut"
                          className="toolbar-customization__tool-input"
                        />
                        <input
                          type="text"
                          value={toolEdits.group || ''}
                          onChange={(e) => handleToolEdit(tool.id, 'group', e.target.value)}
                          placeholder="Group"
                          className="toolbar-customization__tool-input"
                        />
                        <div className="toolbar-customization__tool-edit-actions">
                          <button onClick={saveToolEdits} className="save">Save</button>
                          <button onClick={cancelToolEdits} className="cancel">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="toolbar-customization__tool-display">
                        <span className="toolbar-customization__tool-icon">{tool.icon}</span>
                        <span className="toolbar-customization__tool-label">{tool.label}</span>
                        {tool.shortcut && (
                          <span className="toolbar-customization__tool-shortcut">{tool.shortcut}</span>
                        )}
                        {tool.group && (
                          <span className="toolbar-customization__tool-group">{tool.group}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="toolbar-customization__tool-actions">
                    <button
                      className={`toolbar-customization__tool-toggle ${tool.visible ? 'visible' : 'hidden'}`}
                      onClick={() => toggleToolVisibility(tool.id)}
                      title={tool.visible ? 'Hide tool' : 'Show tool'}
                    >
                      {tool.visible ? '👁️' : '🙈'}
                    </button>
                    <button
                      className="toolbar-customization__tool-edit-btn"
                      onClick={() => startEditingTool(tool)}
                      title="Edit tool"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'configs' && (
          <div className="toolbar-customization__configs">
            <h4>Available Configurations</h4>
            <div className="toolbar-customization__configs-list">
              {availableConfigs.map((config) => (
                <div
                  key={config.id}
                  className={`toolbar-customization__config ${
                    config.id === currentConfig.id ? 'active' : ''
                  }`}
                >
                  <div className="toolbar-customization__config-info">
                    <h5>{config.name}</h5>
                    <p>
                      {config.tools.length} tools • 
                      {config.isDefault ? ' Default' : ' Custom'}
                    </p>
                  </div>
                  <div className="toolbar-customization__config-actions">
                    {config.id === currentConfig.id && (
                      <span className="toolbar-customization__config-current">Current</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'import-export' && (
          <div className="toolbar-customization__import-export">
            <div className="toolbar-customization__export">
              <h4>Export Configurations</h4>
              <p>Export your current toolbar configurations to a file.</p>
              <button
                className="toolbar-customization__export-btn"
                onClick={handleExport}
              >
                Export Configurations
              </button>
            </div>

            <div className="toolbar-customization__import">
              <h4>Import Configurations</h4>
              <p>Import toolbar configurations from a file.</p>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="toolbar-customization__import-input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolbarCustomization;