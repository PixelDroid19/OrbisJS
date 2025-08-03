import React, { useEffect, useRef } from 'react';
import type { ContextMenuItem } from '../hooks/useContextMenu';
import './ContextMenu.css';

export interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  items,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && menuRef.current) {
      // Adjust position if menu would go off-screen
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      menu.style.left = `${Math.max(10, adjustedX)}px`;
      menu.style.top = `${Math.max(10, adjustedY)}px`;
    }
  }, [visible, x, y]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && !item.separator) {
      item.action();
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, item: ContextMenuItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label="Context menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000
      }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return <div key={`separator-${index}`} className="context-menu__separator" />;
        }

        return (
          <div
            key={item.id}
            className={`context-menu__item ${item.disabled ? 'context-menu__item--disabled' : ''}`}
            role="menuitem"
            tabIndex={item.disabled ? -1 : 0}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => handleKeyDown(e, item)}
            aria-disabled={item.disabled || false}
          >
            <span className="context-menu__label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu__shortcut">{item.shortcut}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;