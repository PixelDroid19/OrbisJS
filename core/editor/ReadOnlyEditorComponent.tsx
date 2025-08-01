import React, { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';

export interface ReadOnlyEditorProps {
  content: string;
  language?: 'javascript' | 'json' | 'text';
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

export const ReadOnlyEditorComponent: React.FC<ReadOnlyEditorProps> = ({
  content,
  language = 'text',
  theme = 'dark',
  className = '',
  style = {}
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create extensions for read-only editor
    const extensions: Extension[] = [
      basicSetup,
      EditorView.editable.of(false), // Make editor read-only
      EditorState.readOnly.of(true), // Make state read-only
      EditorView.theme({
        '&': {
          fontSize: '14px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          height: '100%'
        },
        '.cm-content': {
          padding: '12px',
          minHeight: '100%'
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          height: '100%'
        },
        '.cm-scroller': {
          fontFamily: 'inherit',
          overflow: 'auto'
        }
      })
    ];

    // Add language support
    if (language === 'javascript') {
      extensions.push(javascript());
    }

    // Add theme
    if (theme === 'dark') {
      extensions.push(oneDark);
    }

    // Create editor state
    const state = EditorState.create({
      doc: content,
      extensions
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    // Cleanup function
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, theme]); // Re-create editor when language or theme changes

  // Update content when it changes
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content
          }
        });
      }
    }
  }, [content]);

  return (
    <div 
      ref={containerRef}
      className={`readonly-editor ${className}`}
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
        ...style
      }}
    />
  );
};