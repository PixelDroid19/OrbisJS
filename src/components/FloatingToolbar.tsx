import React, { useState, useRef } from 'react';
import type { LanguageType } from '../../core/editor';
import { useKeyboardShortcuts, type KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { useContextMenu } from '../hooks/useContextMenu';
import { useToolbarCustomization } from '../hooks/useToolbarCustomization';
import ContextMenu from './ContextMenu';
import ToolbarCustomization from './ToolbarCustomization';
import './FloatingToolbar.css';

export interface ToolbarContext {
  fileType: LanguageType;
  hasSelection: boolean;
  isReadOnly: boolean;
  lineCount: number;
  cursorPosition?: { line: number; column: number };
  editorFocused?: boolean;
  panelWidth?: number;
}

export interface ToolbarItem {
  id: string;
  icon: string;
  label: string;
  action: () => void;
  shortcut?: string;
  visible: boolean;
  disabled?: boolean;
  group?: string;
  tooltip?: string;
}

export type ToolbarPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface FloatingToolbarProps {
  visible: boolean;
  position: ToolbarPosition;
  context: ToolbarContext;
  tools: ToolbarItem[];
  onToggle: () => void;
  onCustomize?: () => void;
  onLanguageChange?: (language: LanguageType) => void;
  className?: string;
  keyboardShortcutsEnabled?: boolean;
  showContextMenuOnRightClick?: boolean;
  showHeaderControls?: boolean;
}

const DEFAULT_TOOLS: Record<LanguageType, ToolbarItem[]> = {
  javascript: [
    {
      id: 'format',
      icon: '⚡',
      label: 'Format Code',
      action: () => console.log('Format JS'),
      shortcut: 'Ctrl+Shift+F',
      visible: true,
      group: 'formatting',
      tooltip: 'Format JavaScript code'
    },
    {
      id: 'run',
      icon: '▶️',
      label: 'Run Code',
      action: () => console.log('Run JS'),
      shortcut: 'Ctrl+Enter',
      visible: true,
      group: 'execution',
      tooltip: 'Execute JavaScript code'
    },
    {
      id: 'lint',
      icon: '🔍',
      label: 'Lint Code',
      action: () => console.log('Lint JS'),
      visible: true,
      group: 'analysis',
      tooltip: 'Check code for issues'
    }
  ],
  typescript: [
    {
      id: 'format',
      icon: '⚡',
      label: 'Format Code',
      action: () => console.log('Format TS'),
      shortcut: 'Ctrl+Shift+F',
      visible: true,
      group: 'formatting',
      tooltip: 'Format TypeScript code'
    },
    {
      id: 'compile',
      icon: '🔨',
      label: 'Compile',
      action: () => console.log('Compile TS'),
      shortcut: 'Ctrl+B',
      visible: true,
      group: 'compilation',
      tooltip: 'Compile TypeScript to JavaScript'
    },
    {
      id: 'run',
      icon: '▶️',
      label: 'Run Code',
      action: () => console.log('Run TS'),
      shortcut: 'Ctrl+Enter',
      visible: true,
      group: 'execution',
      tooltip: 'Execute TypeScript code'
    },
    {
      id: 'types',
      icon: '📋',
      label: 'Check Types',
      action: () => console.log('Check Types'),
      visible: true,
      group: 'analysis',
      tooltip: 'Perform type checking'
    }
  ],
  json: [
    {
      id: 'format',
      icon: '⚡',
      label: 'Format JSON',
      action: () => console.log('Format JSON'),
      shortcut: 'Ctrl+Shift+F',
      visible: true,
      group: 'formatting',
      tooltip: 'Format JSON structure'
    },
    {
      id: 'validate',
      icon: '✅',
      label: 'Validate',
      action: () => console.log('Validate JSON'),
      visible: true,
      group: 'validation',
      tooltip: 'Validate JSON syntax'
    }
  ],
  css: [
    {
      id: 'format',
      icon: '⚡',
      label: 'Format CSS',
      action: () => console.log('Format CSS'),
      shortcut: 'Ctrl+Shift+F',
      visible: true,
      group: 'formatting',
      tooltip: 'Format CSS code'
    },
    {
      id: 'minify',
      icon: '📦',
      label: 'Minify',
      action: () => console.log('Minify CSS'),
      visible: true,
      group: 'optimization',
      tooltip: 'Minify CSS for production'
    },
    {
      id: 'lint',
      icon: '🔍',
      label: 'Lint CSS',
      action: () => console.log('Lint CSS'),
      visible: true,
      group: 'analysis',
      tooltip: 'Check CSS for issues'
    }
  ],
  html: [
    {
      id: 'format',
      icon: '⚡',
      label: 'Format HTML',
      action: () => console.log('Format HTML'),
      shortcut: 'Ctrl+Shift+F',
      visible: true,
      group: 'formatting',
      tooltip: 'Format HTML structure'
    },
    {
      id: 'validate',
      icon: '✅',
      label: 'Validate',
      action: () => console.log('Validate HTML'),
      visible: true,
      group: 'validation',
      tooltip: 'Validate HTML markup'
    },
    {
      id: 'preview',
      icon: '👁️',
      label: 'Preview',
      action: () => console.log('Preview HTML'),
      shortcut: 'Ctrl+Shift+P',
      visible: true,
      group: 'preview',
      tooltip: 'Preview HTML in browser'
    }
  ]
};

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  visible,
  position,
  context,
  tools,
  onToggle,
  onCustomize,
  onLanguageChange,
  className = '',
  keyboardShortcutsEnabled = true,
  showContextMenuOnRightClick = true,
  showHeaderControls = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const { contextMenu, showContextMenu, hideContextMenu, createToolbarContextMenu } = useContextMenu();

  // Filter tools based on context - only show the most important ones
  const visibleTools = tools.filter(tool => 
    tool.visible && 
    !(tool.id === 'selection-tools' && !context.hasSelection) &&
    !(tool.disabled && context.isReadOnly)
  );

  const handleToolAction = (tool: ToolbarItem) => {
    if (!tool.disabled && typeof tool.action === 'function') {
      tool.action();
    } else if (!tool.disabled) {
      console.warn('Tool action is not a function:', tool);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, tool: ToolbarItem) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToolAction(tool);
    }
  };

  // Keyboard shortcuts for toolbar toggle
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 't',
      ctrlKey: true,
      shiftKey: true,
      action: onToggle,
      description: 'Toggle floating toolbar visibility',
      enabled: keyboardShortcutsEnabled
    }
  ];

  useKeyboardShortcuts(shortcuts);

  if (!visible) {
    return (
      <>
        <ContextMenu
          visible={contextMenu.visible}
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={hideContextMenu}
        />
      </>
    );
  }

  return (
    <>
      {/* Portal para renderizar el toolbar fuera del contenedor del editor */}
      <div
        ref={toolbarRef}
        className={`floating-toolbar-global ${className} ${
          isHovered ? 'floating-toolbar-global--hovered' : ''
        } ${showHeaderControls ? 'floating-toolbar-global--with-header' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="toolbar"
        aria-label="Floating editor toolbar"
      >
        {/* Header controls migrados desde EditorPanel */}
        {showHeaderControls && (
          <div className="floating-toolbar-global__header">
            <div className="floating-toolbar-global__header-left">
              <select 
                className="floating-toolbar-global__language-select"
                value={context.fileType} 
                onChange={(e) => onLanguageChange?.(e.target.value as LanguageType)}
                aria-label="Select programming language"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="json">JSON</option>
                <option value="css">CSS</option>
                <option value="html">HTML</option>
              </select>
              
              {/* Status indicators */}
              <div className="floating-toolbar-global__status">
                {context.cursorPosition && (
                  <span 
                    className="floating-toolbar-global__status-item" 
                    title={`Line ${context.cursorPosition.line}, Column ${context.cursorPosition.column}`}
                  >
                    {context.cursorPosition.line}:{context.cursorPosition.column}
                  </span>
                )}
                {context.hasSelection && (
                  <span 
                    className="floating-toolbar-global__status-item floating-toolbar-global__status-item--selection" 
                    title="Text selected"
                  >
                    📝
                  </span>
                )}
                {context.editorFocused && (
                  <span 
                    className="floating-toolbar-global__status-item floating-toolbar-global__status-item--focused" 
                    title="Editor focused"
                  >
                    🎯
                  </span>
                )}
              </div>
            </div>
            
            <div className="floating-toolbar-global__header-right">
              <button
                className={`floating-toolbar-global__toggle ${visible ? 'floating-toolbar-global__toggle--active' : ''}`}
                onClick={onToggle}
                title="Toggle floating toolbar"
                aria-label="Toggle floating toolbar"
                aria-pressed={visible}
              >
                <span className="floating-toolbar-global__toggle-icon">🔧</span>
                <span className="floating-toolbar-global__toggle-label">Toolbar</span>
              </button>
            </div>
          </div>
        )}

        <div className="floating-toolbar-global__content">
          {visibleTools.map((tool) => (
            <button
              key={tool.id}
              className={`floating-toolbar-global__item ${tool.disabled ? 'floating-toolbar-global__item--disabled' : ''}`}
              onClick={() => handleToolAction(tool)}
              onKeyDown={(e) => handleKeyDown(e, tool)}
              disabled={tool.disabled}
              title={tool.tooltip ? `${tool.tooltip}${tool.shortcut ? ` (${tool.shortcut})` : ''}` : `${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              aria-label={tool.label}
            >
              <span className="floating-toolbar-global__icon" aria-hidden="true">
                {tool.icon}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items}
        onClose={hideContextMenu}
      />
      
      {showCustomization && (
        <ToolbarCustomization
          context={context}
          onClose={() => setShowCustomization(false)}
        />
      )}
    </>
  );
};

export default FloatingToolbar;