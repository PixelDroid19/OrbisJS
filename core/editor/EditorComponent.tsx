import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { CodeMirrorEditorEngine, EditorEngine } from './EditorEngine';
import { EditorConfig, LanguageType, Position, Selection } from './types';
import { WebContainerRunner } from '../runner/WebContainerRunner';

export interface EditorComponentProps {
  initialContent?: string;
  language?: LanguageType;
  config?: Partial<EditorConfig>;
  onChange?: (content: string) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onCursorMove?: (position: Position) => void;
  runner?: WebContainerRunner;
  className?: string;
  style?: React.CSSProperties;
}

export interface EditorComponentRef {
  getEditor(): EditorEngine;
  focus(): void;
  getContent(): string;
  setContent(content: string): void;
}

export const EditorComponent = forwardRef<EditorComponentRef, EditorComponentProps>(
  ({ 
    initialContent = '', 
    language = 'javascript', 
    config = {}, 
    onChange, 
    onSelectionChange, 
    onCursorMove,
    runner,
    className = '',
    style = {}
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorEngine | null>(null);
    const callbacksRef = useRef({ onChange, onSelectionChange, onCursorMove });

    // Actualizar refs de callbacks
    useEffect(() => {
      callbacksRef.current = { onChange, onSelectionChange, onCursorMove };
    });

    useImperativeHandle(ref, () => ({
      getEditor: () => editorRef.current!,
      focus: () => editorRef.current?.focus(),
      getContent: () => editorRef.current?.getContent() || '',
      setContent: (content: string) => editorRef.current?.setContent(content)
    }));

    useEffect(() => {
    if (!containerRef.current) return;

    // Create editor engine only once
    const editor = new CodeMirrorEditorEngine(config);
    editorRef.current = editor;

    // Create initial buffer
    const bufferId = 'main';
    editor.createBuffer(bufferId, language);
    editor.switchBuffer(bufferId);

    // Mount editor
    editor.mount(containerRef.current);

    // Set initial content
    if (initialContent) {
      editor.setContent(initialContent);
    }

    // Set up event listeners con callbacks de las refs
    const handleChange = (content: string) => {
      callbacksRef.current.onChange?.(content);
    };
    
    const handleSelectionChange = (selection: Selection | null) => {
      callbacksRef.current.onSelectionChange?.(selection);
    };
    
    const handleCursorMove = (position: Position) => {
      callbacksRef.current.onCursorMove?.(position);
    };

    editor.onChange(handleChange);
    editor.onSelectionChange(handleSelectionChange);
    editor.onCursorMove(handleCursorMove);

    // Integrate with package manager if runner is provided
    if (runner && runner.getPackageManager) {
      const packageManager = runner.getPackageManager();
      if (packageManager) {
        editor.setPackageManager(packageManager);
      }
    }

    // Cleanup
    return () => {
      editor.unmount();
    };
  }, [runner]); // Incluir runner para que el useEffect se ejecute cuando cambie

    // Update language when prop changes
    useEffect(() => {
      if (editorRef.current) {
        editorRef.current.setLanguage(language);
        editorRef.current.focus();
      }
    }, [language]);

    // Update content when prop changes
    useEffect(() => {
      if (editorRef.current && initialContent !== editorRef.current.getContent()) {
        editorRef.current.setContent(initialContent || '');
      }
    }, [initialContent]);

    // Update config when prop changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateConfig(config);
    }
  }, [config]);

  // Update package manager when runner changes
  useEffect(() => {
    if (editorRef.current && runner && runner.getPackageManager) {
      const packageManager = runner.getPackageManager();
      if (packageManager) {
        editorRef.current.setPackageManager(packageManager);
      }
    }
  }, [runner]);

  // Listen for package installation events
  useEffect(() => {
    if (editorRef.current && runner && runner.getPackageManager) {
      const packageManager = runner.getPackageManager();
      if (packageManager) {
        const handlePackageUpdate = () => {
          // Refresh package completions when packages are installed/updated
          editorRef.current?.refreshPackageCompletions();
        };

        packageManager.on('packageInstalled', handlePackageUpdate);
        packageManager.on('packagesLoaded', handlePackageUpdate);

        return () => {
          packageManager.off('packageInstalled', handlePackageUpdate);
          packageManager.off('packagesLoaded', handlePackageUpdate);
        };
      }
    }
  }, [runner]);

    return (
      <div 
        ref={containerRef} 
        className={`editor-container ${className}`}
        style={{
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          ...style
        }}
      />
    );
  }
);

EditorComponent.displayName = 'EditorComponent';