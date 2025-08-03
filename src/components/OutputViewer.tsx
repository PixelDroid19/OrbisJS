import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import './OutputViewer.css';

export interface OutputViewerProps {
  content: string;
  language?: 'javascript' | 'json' | 'text' | 'html';
  isError?: boolean;
  className?: string;
  maxHeight?: string;
}

export const OutputViewer: React.FC<OutputViewerProps> = ({
  content,
  language = 'text',
  isError = false,
  className = '',
  maxHeight = '300px'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Limpiar editor anterior si existe
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Determinar las extensiones según el lenguaje
    const getLanguageExtension = () => {
      switch (language) {
        case 'javascript':
          return javascript();
        case 'json':
          try {
            // Verificar si el contenido es JSON válido
            JSON.parse(content);
            return json();
          } catch {
            return javascript(); // Fallback a JavaScript si no es JSON válido
          }
        case 'html':
          return javascript(); // Por ahora usamos JavaScript como fallback
        default:
          return [];
      }
    };

    // Configurar extensiones
    const extensions = [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ tabindex: '0' }),
      oneDark,
      getLanguageExtension(),
      // Configuración de tema personalizado para errores
      EditorView.theme({
        '&': {
          fontSize: '13px',
          maxHeight: maxHeight,
          overflow: 'auto'
        },
        '.cm-content': {
          padding: '12px',
          fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
          lineHeight: '1.4',
          color: isError ? '#ff6b6b' : '#d4d4d4'
        },
        '.cm-focused': {
          outline: 'none'
        },
        '.cm-editor': {
          borderRadius: '0',
          border: 'none'
        },
        '.cm-scroller': {
          fontFamily: '"Fira Code", "Consolas", "Monaco", monospace'
        }
      })
    ];

    // Crear el editor
    const view = new EditorView({
      parent: editorRef.current,
      state: EditorState.create({
        doc: content,
        extensions
      })
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [content, language, isError, maxHeight]);

  return (
    <div className={`output-viewer ${isError ? 'error' : ''} ${className}`}>
      <div ref={editorRef} className="output-viewer__editor" />
    </div>
  );
};

export default OutputViewer;