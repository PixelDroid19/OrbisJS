import React, { useState } from 'react';
import { Tab } from '../hooks/useTabs';
import './TabBar.css';

interface TabBarProps {
  tabs: Tab[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
  onTabRename?: (id: string, newName: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabRename
}) => {
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleTabDoubleClick = (tab: Tab) => {
    if (onTabRename) {
      setEditingTab(tab.id);
      setEditName(tab.name);
    }
  };

  const handleEditSubmit = (tabId: string) => {
    if (onTabRename && editName.trim()) {
      onTabRename(tabId, editName.trim());
    }
    setEditingTab(null);
    setEditName('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleEditSubmit(tabId);
    } else if (e.key === 'Escape') {
      setEditingTab(null);
      setEditName('');
    }
  };

  const getTabIcon = (language: string) => {
    switch (language) {
      case 'javascript': return '🟨';
      case 'typescript': return '🔷';
      case 'json': return '📋';
      case 'css': return '🎨';
      case 'html': return '🌐';
      default: return '📄';
    }
  };

  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.isActive ? 'active' : ''} ${tab.modified ? 'modified' : ''}`}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={() => handleTabDoubleClick(tab)}
          >
            <span className="tab-icon">{getTabIcon(tab.language)}</span>
            
            {editingTab === tab.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleEditSubmit(tab.id)}
                onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                className="tab-name-input"
                autoFocus
              />
            ) : (
              <span className="tab-name">
                {tab.name}
                {tab.modified && <span className="modified-indicator">●</span>}
              </span>
            )}
            
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              title="Cerrar pestaña"
            >
              ×
            </button>
          </div>
        ))}
        
        <button className="new-tab-btn" onClick={onNewTab} title="Nueva pestaña">
          + Nuevo
        </button>
      </div>
    </div>
  );
};