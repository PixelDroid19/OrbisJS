import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorComponent, EditorComponentRef, LanguageType, Position, Selection } from '../../core/editor';
import './EditorPanel.css';

export interface EditorPanelProps {
  activeTab: {
    id: string;
    name: string;
    content: string;
    language: LanguageType;
    modified?: boolean;
  } | null;
  onContentChange: (content: string) => void;
  onSelectionChange?: (hasSelection: boolean) => void;
  onCursorMove?: (position: Position) => void;
  onFocusChange?: (focused: boolean) => void;
  onRunCode?: () => void;
  className?: string;
}

export const EditorPanel = forwardRef<EditorComponentRef, EditorPanelProps>(({
  activeTab,
  onContentChange,
  onSelectionChange,
  onCursorMove,
  onFocusChange,
  onRunCode,
  className = ''
}, ref) => {
  const editorRef = useRef<EditorComponentRef>(null);
  
  // Expose editor methods to parent component
  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getContent: () => editorRef.current?.getContent() || '',
    setContent: (content: string) => editorRef.current?.setContent(content),
    getEditor: () => editorRef.current?.getEditor() || null
  }), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<Position>({ line: 1, column: 1 });
  const [panelWidth, setPanelWidth] = useState(0);

  // Handle editor focus management
  const handleEditorFocus = useCallback(() => {
    setEditorFocused(true);
    onFocusChange?.(true);
  }, [onFocusChange]);

  const handleEditorBlur = useCallback(() => {
    setEditorFocused(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  // Handle selection changes
  const handleSelectionChange = useCallback((selection: Selection | null) => {
    const hasSelectionValue = selection !== null && selection.from !== selection.to;
    setHasSelection(hasSelectionValue);
    onSelectionChange?.(hasSelectionValue);
  }, [onSelectionChange]);

  // Handle cursor position changes
  const handleCursorMoveInternal = useCallback((position: Position) => {
    setCursorPosition(position);
    onCursorMove?.(position);
  }, [onCursorMove]);

  // Monitor panel width for responsive behavior
  useEffect(() => {
    const updatePanelWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setPanelWidth(width);
      }
    };

    updatePanelWidth();
    
    // Handle ResizeObserver gracefully
    if (typeof ResizeObserver !== 'undefined') {
      try {
        const resizeObserver = new ResizeObserver(updatePanelWidth);
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }

        return () => {
          resizeObserver.disconnect();
        };
      } catch (error) {
        console.warn('ResizeObserver not available or failed to initialize:', error);
      }
    }

    // Fallback: listen to window resize
    const handleWindowResize = () => updatePanelWidth();
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  if (!activeTab) {
    return (
      <div className={`editor-panel editor-panel--empty ${className}`} ref={containerRef}>
        <div className="editor-panel__empty-state">
          <div className="editor-panel__empty-icon">📝</div>
          <p>No file selected</p>
          <small>Create or select a tab to start editing</small>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`editor-panel ${editorFocused ? 'editor-panel--focused' : ''} ${className}`}
      ref={containerRef}
      data-panel-width={panelWidth}
    >
      {/* Simplified editor container - header functionality moved to FloatingToolbar */}
      <div className="editor-panel__editor-container">
        <div
          className="editor-panel__editor-wrapper"
          onFocus={handleEditorFocus}
          onBlur={handleEditorBlur}
          tabIndex={-1}
        >
          <EditorComponent
            ref={editorRef}
            initialContent={activeTab.content}
            language={activeTab.language}
            onChange={onContentChange}
            onSelectionChange={handleSelectionChange}
            onCursorMove={handleCursorMoveInternal}
            config={{
              theme: 'dark',
              fontSize: panelWidth < 400 ? 12 : 14,
              tabSize: 2,
              lineNumbers: true,
              wordWrap: panelWidth < 500,
              autoComplete: true,
              linting: true
            }}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
        
        {/* Focus overlay for better visual feedback */}
        {editorFocused && <div className="editor-panel__focus-overlay" />}
      </div>
    </div>
  );
});

EditorPanel.displayName = 'EditorPanel';

export default EditorPanel;