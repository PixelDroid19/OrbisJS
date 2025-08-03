import { useState, useCallback, useEffect } from 'react';
import type { ToolbarItem } from '../components/FloatingToolbar';

export interface ContextMenuItem {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: []
  });

  const showContextMenu = useCallback((
    event: React.MouseEvent | MouseEvent,
    items: ContextMenuItem[]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const createToolbarContextMenu = useCallback((
    toolbarItems: ToolbarItem[],
    onShowToolbar?: () => void
  ): ContextMenuItem[] => {
    const menuItems: ContextMenuItem[] = [];

    // Add toolbar items as context menu items
    toolbarItems
      .filter(item => item.visible && !item.disabled)
      .forEach(item => {
        menuItems.push({
          id: item.id,
          label: item.label,
          action: item.action,
          shortcut: item.shortcut,
          disabled: item.disabled
        });
      });

    // Add separator and show toolbar option if callback provided
    if (onShowToolbar && menuItems.length > 0) {
      menuItems.push({
        id: 'separator',
        label: '',
        action: () => {},
        separator: true
      });
    }

    if (onShowToolbar) {
      menuItems.push({
        id: 'show-toolbar',
        label: 'Show Floating Toolbar',
        action: onShowToolbar,
        shortcut: 'Ctrl+Shift+T'
      });
    }

    return menuItems;
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        hideContextMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && contextMenu.visible) {
        hideContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu.visible, hideContextMenu]);

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    createToolbarContextMenu
  };
};

export default useContextMenu;