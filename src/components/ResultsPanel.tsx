import React, { useRef, useState, useEffect } from 'react';
import { OutputViewer } from './OutputViewer';
import './ResultsPanel.css';

export interface ResultsPanelProps {
  output: string;
  error: string;
  isRunning: boolean;
  isInitializing?: boolean;
  initError?: string;
  onRetry?: () => void;
  onHardReset?: () => void;
  onClear?: () => void;
  className?: string;
  errorDetails?: {
    type: 'runtime' | 'syntax' | 'network' | 'timeout' | 'unknown';
    line?: number;
    column?: number;
    stack?: string;
  };
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  output,
  error,
  isRunning,
  isInitializing = false,
  initError,
  onRetry,
  onHardReset,
  onClear,
  className = '',
  errorDetails
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(0);

  // Update panel width when component mounts or resizes
  useEffect(() => {
    const updateWidth = () => {
      if (panelRef.current) {
        setPanelWidth(panelRef.current.offsetWidth);
      }
    };

    updateWidth();

    // Use ResizeObserver if available, otherwise fall back to window resize
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateWidth);
      if (panelRef.current) {
        resizeObserver.observe(panelRef.current);
      }
      return () => resizeObserver.disconnect();
    } else {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  // Determine layout classes based on panel width
  const isNarrow = panelWidth > 0 && panelWidth < 400;
  const isVeryNarrow = panelWidth > 0 && panelWidth < 250;

  // Function to clean and improve error messages
  const cleanErrorMessage = (errorMsg: string): string => {
    if (!errorMsg) return '';
    
    // Remove file paths and technical details
    let cleaned = errorMsg
      // Remove file paths (Windows and Unix style)
      .replace(/[A-Za-z]:\\[^\\]+\\[^\\]+\\[^\s]+/g, '')
      .replace(/\/[^\/\s]+\/[^\/\s]+\/[^\s]+/g, '')
      // Remove "Execution failed" prefix
      .replace(/^Execution failed\s*/i, '')
      // Remove extra whitespace and newlines at the start
      .replace(/^\s+/, '')
      // Clean up multiple spaces
      .replace(/\s+/g, ' ')
      .trim();

    // If the message is empty after cleaning, provide a generic but helpful message
    if (!cleaned) {
      return 'Error durante la ejecución del código';
    }

    // Add helpful context for common errors
    if (cleaned.toLowerCase().includes('syntaxerror')) {
      return `Error de sintaxis: ${cleaned.replace(/syntaxerror:?\s*/i, '')}`;
    }
    
    if (cleaned.toLowerCase().includes('referenceerror')) {
      return `Variable no definida: ${cleaned.replace(/referenceerror:?\s*/i, '')}`;
    }
    
    if (cleaned.toLowerCase().includes('typeerror')) {
      return `Error de tipo: ${cleaned.replace(/typeerror:?\s*/i, '')}`;
    }

    if (cleaned.toLowerCase().includes('timeout')) {
      return 'El código tardó demasiado en ejecutarse (timeout)';
    }

    return cleaned;
   };

  // Function to detect output language for syntax highlighting
  const detectOutputLanguage = (content: string): 'javascript' | 'json' | 'text' | 'html' => {
    if (!content) return 'text';
    
    const trimmed = content.trim();
    
    // Check if it's JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON, continue checking
      }
    }
    
    // Check if it's HTML
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
      return 'html';
    }
    
    // Check if it looks like JavaScript code
    if (trimmed.includes('function') || 
        trimmed.includes('=>') || 
        trimmed.includes('const ') || 
        trimmed.includes('let ') || 
        trimmed.includes('var ') ||
        trimmed.includes('console.')) {
      return 'javascript';
    }
    
    return 'text';
  };

  const renderContent = () => {
    // Show initialization error if present
    if (initError) {
      return (
        <div className={`results-panel__error-display ${isNarrow ? 'narrow' : ''} ${isVeryNarrow ? 'very-narrow' : ''}`}>
          <div className="results-panel__error-icon">⚠️</div>
          <div className="results-panel__error-details">
            <h4>Initialization Error</h4>
            <p>{initError}</p>
            <div className="results-panel__error-actions">
              {onRetry && (
                <button 
                  className="results-panel__retry-btn" 
                  onClick={onRetry}
                  disabled={isInitializing}
                  title={isInitializing ? 'Retrying...' : 'Retry initialization'}
                >
                  {isVeryNarrow ? '🔄' : (isInitializing ? 'Retrying...' : 'Retry')}
                </button>
              )}
              <button 
                className="results-panel__refresh-btn" 
                onClick={() => window.location.reload()}
                title="Refresh page"
              >
                {isVeryNarrow ? '🔃' : 'Refresh'}
              </button>
              {onHardReset && (
                <button 
                  className="results-panel__hard-reset-btn" 
                  onClick={onHardReset}
                  disabled={isInitializing}
                  title="Hard reset"
                >
                  {isVeryNarrow ? '🔥' : 'Reset'}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Show output or error if available
    if (output || error) {
      return (
        <div className={`results-panel__output-display ${isNarrow ? 'narrow' : ''} ${isVeryNarrow ? 'very-narrow' : ''}`}>
          {output && (
            <div className="results-panel__output-section">
              <OutputViewer
                content={output}
                language={detectOutputLanguage(output)}
                maxHeight="100%"
                className="results-panel__output-viewer"
              />
            </div>
          )}
          {error && (
            <div className="results-panel__error-section">
              <div className="results-panel__error-content">
                 <OutputViewer
                   content={cleanErrorMessage(error)}
                   language="text"
                   isError={true}
                   maxHeight="100%"
                   className="results-panel__error-viewer"
                 />
                 {errorDetails && errorDetails.line && (
                   <div className="results-panel__error-location">
                     📍 Línea {errorDetails.line}{errorDetails.column ? `, columna ${errorDetails.column}` : ''}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      );
    }

    // Show running state
    if (isRunning) {
      return (
        <div className={`results-panel__running-state ${isNarrow ? 'narrow' : ''} ${isVeryNarrow ? 'very-narrow' : ''}`}>
          <div className="results-panel__running-icon">⏳</div>
          <p>{isVeryNarrow ? 'Running...' : 'Executing code...'}</p>
          <div className="results-panel__running-spinner"></div>
        </div>
      );
    }

    // Show empty state
    return (
      <div className={`results-panel__empty-state ${isNarrow ? 'narrow' : ''} ${isVeryNarrow ? 'very-narrow' : ''}`}>
        <div className="results-panel__empty-icon">🚀</div>
        <p>{isVeryNarrow ? 'Run code to see results' : 'Execute your code to see results here'}</p>
        {!isVeryNarrow && (
          <div className="results-panel__empty-hint">
            <small>Use the "Run" button or Ctrl+Enter</small>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={panelRef}
      className={`results-panel ${className} ${isNarrow ? 'narrow' : ''} ${isVeryNarrow ? 'very-narrow' : ''}`}
      data-width={panelWidth}
    >
      <div className="results-panel__content">
        {renderContent()}
      </div>
    </div>
  );
};

export default ResultsPanel;