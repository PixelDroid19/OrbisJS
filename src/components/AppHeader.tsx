import React from 'react';
import { TabBar } from './TabBar';
import { Tab } from '../hooks/useTabs';

interface AppHeaderProps {
  tabs: Tab[];
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  onTabRename: (tabId: string, newName: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  tabs,
  onTabClick,
  onTabClose,
  onNewTab,
  onTabRename
}) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="app-title">
          <span className="app-icon">⚡</span>
          <span>RunJS Local + AI</span>
        </div>
        <TabBar
          tabs={tabs}
          onTabClick={onTabClick}
          onTabClose={onTabClose}
          onNewTab={onNewTab}
          onTabRename={onTabRename}
        />
      </div>
      <div className="header-right">
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span>{tabs.length} pestaña{tabs.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="settings-btn">⚙️</button>
      </div>
    </header>
  );
};