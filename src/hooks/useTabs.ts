import { useState, useCallback } from 'react';
import { LanguageType } from '../../core/editor';

export interface Tab {
  id: string;
  name: string;
  content: string;
  language: LanguageType;
  modified: boolean;
  isActive: boolean;
}

export interface UseTabsReturn {
  tabs: Tab[];
  activeTab: Tab | null;
  createTab: (name?: string, content?: string, language?: LanguageType) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Omit<Tab, 'id'>>) => void;
  renameTab: (id: string, newName: string) => void;
}

export const useTabs = (): UseTabsReturn => {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'tab-1',
      name: 'untitled',
      content: `console.log('A')`,
      language: 'javascript',
      modified: false,
      isActive: true
    }
  ]);

  const activeTab = tabs.find(tab => tab.isActive) || null;

  const createTab = useCallback((
    name: string = 'untitled',
    content: string = '',
    language: LanguageType = 'javascript'
  ): string => {
    const newId = `tab-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      name,
      content,
      language,
      modified: false,
      isActive: false
    };

    setTabs(prevTabs => [
      ...prevTabs.map(tab => ({ ...tab, isActive: false })),
      { ...newTab, isActive: true }
    ]);

    return newId;
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prevTabs => {
      const filteredTabs = prevTabs.filter(tab => tab.id !== id);
      
      // If we closed the active tab, activate the last remaining tab
      if (prevTabs.find(tab => tab.id === id)?.isActive && filteredTabs.length > 0) {
        const lastTab = filteredTabs[filteredTabs.length - 1];
        return filteredTabs.map(tab => 
          tab.id === lastTab.id ? { ...tab, isActive: true } : tab
        );
      }
      
      // If no tabs left, create a new one
      if (filteredTabs.length === 0) {
        return [{
          id: `tab-${Date.now()}`,
          name: 'untitled',
          content: '',
          language: 'javascript',
          modified: false,
          isActive: true
        }];
      }
      
      return filteredTabs;
    });
  }, []);

  const switchTab = useCallback((id: string) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => ({
        ...tab,
        isActive: tab.id === id
      }))
    );
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Omit<Tab, 'id'>>) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === id ? { ...tab, ...updates } : tab
      )
    );
  }, []);

  const renameTab = useCallback((id: string, newName: string) => {
    updateTab(id, { name: newName });
  }, [updateTab]);

  return {
    tabs,
    activeTab,
    createTab,
    closeTab,
    switchTab,
    updateTab,
    renameTab
  };
};