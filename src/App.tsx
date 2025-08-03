import { useState, useRef, useMemo } from 'react';
import { EditorComponentRef, LanguageType } from '../core/editor';
import type { SupportedLanguage } from '../core/runner/index.js';
import { useTabs } from './hooks/useTabs';
import { useWebContainer } from './hooks/useWebContainer';
import { TabBar } from './components/TabBar';
import SplitView from './components/SplitView';
import EditorPanel from './components/EditorPanel';
import ResultsPanel from './components/ResultsPanel';
import FloatingToolbar, { ToolbarContext } from './components/FloatingToolbar';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import ReactPlugin from '@stagewise-plugins/react';
import './App.css';
import './editor-fixes.css';

function App() {
  const { tabs, activeTab, createTab, closeTab, switchTab, updateTab, renameTab } = useTabs();
  const { runner, isInitializing, initError, retryInitialization, hardReset } = useWebContainer();
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [editorFocused, setEditorFocused] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [panelWidth, setPanelWidth] = useState(0);

  const editorRef = useRef<EditorComponentRef>(null);
  
  // Current tab state
  const currentLanguage = activeTab?.language || 'javascript';
  const currentContent = activeTab?.content || '';

  const handleLanguageChange = (newLanguage: LanguageType) => {
    if (activeTab) {
      updateTab(activeTab.id, { language: newLanguage });
    }
  };

  const handleContentChange = (newContent: string) => {
    if (activeTab) {
      const isModified = newContent !== activeTab.content;
      updateTab(activeTab.id, { 
        content: newContent, 
        modified: isModified 
      });
    }
  };

  const handleTabSwitch = (tabId: string) => {
    // Save current editor content before switching
    if (activeTab && editorRef.current) {
      const currentEditorContent = editorRef.current.getContent();
      updateTab(activeTab.id, { content: currentEditorContent });
    }
    switchTab(tabId);
  };

  const handleNewTab = () => {
    createTab(`untitled-${tabs.length + 1}`, '', 'javascript');
  };

  const handleTabClose = (tabId: string) => {
    closeTab(tabId);
  };

  const handleTabRename = (tabId: string, newName: string) => {
    renameTab(tabId, newName);
  };

  const handleToolbarToggle = () => {
    setToolbarVisible(!toolbarVisible);
  };

  const handleSplitChange = (ratio: number) => {
    setSplitRatio(ratio);
    // TODO: Persist split ratio to localStorage
  };

  // Global toolbar context and tools
  const toolbarContext: ToolbarContext = {
    fileType: activeTab?.language || 'javascript',
    hasSelection: hasSelection,
    isReadOnly: false,
    lineCount: activeTab?.content?.split('\n').length || 0,
    cursorPosition: cursorPosition,
    editorFocused: editorFocused,
    panelWidth: panelWidth
  };

  // Define global toolbar tools
  const toolbarTools = useMemo(() => {
    if (!activeTab) return [];
    
    const tools = [];
    
    // Add run code tool
    tools.push({
      id: 'run-code',
      icon: '▶',
      label: 'Run Code',
      action: () => handleRunCode(),
      shortcut: 'Ctrl+Enter',
      visible: true,
      disabled: isRunning || !runner || isInitializing || (runner && !runner.isReady()),
      tooltip: 'Execute the current code'
    });
    
    // Add format tool
    tools.push({
      id: 'format',
      icon: '⚡',
      label: 'Format',
      action: () => {
        if (editorRef.current) {
          console.log('Format code');
        }
      },
      shortcut: 'Shift+Alt+F',
      visible: true,
      disabled: false,
      tooltip: 'Format code'
    });
    
    // Add link tool
    tools.push({
      id: 'link',
      icon: '🔗',
      label: 'Link',
      action: () => {
        console.log('Create link');
      },
      visible: true,
      disabled: false,
      tooltip: 'Create link'
    });
    
    // Add edit tool
    tools.push({
      id: 'edit',
      icon: '✏️',
      label: 'Edit',
      action: () => {
        console.log('Edit mode');
      },
      visible: true,
      disabled: false,
      tooltip: 'Edit mode'
    });
    
    // Add preview tool
    tools.push({
      id: 'preview',
      icon: '👁️',
      label: 'Preview',
      action: () => {
        console.log('Preview');
      },
      visible: true,
      disabled: false,
      tooltip: 'Preview'
    });
    
    // Add copy tool
    tools.push({
      id: 'copy',
      icon: '📋',
      label: 'Copy',
      action: () => {
        if (editorRef.current) {
          const content = editorRef.current.getContent();
          navigator.clipboard.writeText(content);
        }
      },
      visible: true,
      disabled: false,
      tooltip: 'Copy'
    });
    
    // Add save tool
    tools.push({
      id: 'save',
      icon: '💾',
      label: 'Save',
      action: () => {
        console.log('Save file');
      },
      shortcut: 'Ctrl+S',
      visible: true,
      disabled: false,
      tooltip: 'Save file'
    });
    
    return tools;
  }, [activeTab, isRunning, runner, isInitializing]);

  const handleClearError = () => {
    setError('');
  };

  const handleRunCode = async () => {
    const currentContent = editorRef.current?.getContent();
    if (!currentContent || !activeTab) return;
    
    // Verificación mejorada del estado del runner
    if (!runner) {
      setError('❌ Runner no está disponible. Por favor, espera a que se complete la inicialización o usa "Reintentar".');
      return;
    }

    if (isInitializing) {
      setError('⏳ Runner se está inicializando. Por favor, espera un momento...');
      return;
    }

    // Verificación adicional del estado interno del runner
    if (!runner.isReady()) {
      setError('⚠️ Runner no está listo. Intentando reinicializar...');
      try {
        await retryInitialization();
        return;
      } catch (err) {
        setError('❌ Error al reinicializar el Runner: ' + (err instanceof Error ? err.message : String(err)));
        return;
      }
    }

    setIsRunning(true);
    setOutput('');
    setError('');

    try {
      const languageMap: Record<LanguageType, SupportedLanguage> = {
        'javascript': 'javascript',
        'typescript': 'typescript',
        'json': 'javascript',
        'css': 'javascript',
        'html': 'javascript'
      };
      
      const runnerLanguage = languageMap[currentLanguage] || 'javascript';
      const filename = `${activeTab.name}.${currentLanguage === 'typescript' ? 'ts' : 'js'}`;
      
      const result = await runner.runCode(currentContent, runnerLanguage, { filename });
      
      if (result.success) {
        setOutput(result.output);
      } else {
        // Mejorar el mensaje de error
        const errorMsg = result.error || 'Error durante la ejecución';
        setError(errorMsg);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Manejo específico de diferentes tipos de errores
      if (errorMessage.includes('Runner not initialized')) {
        setError('El sistema de ejecución no está inicializado. Usa el botón "Reintentar".');
      } else if (errorMessage.includes('timeout')) {
        setError('El código tardó demasiado en ejecutarse. Verifica si hay bucles infinitos.');
      } else if (errorMessage.includes('WebContainer')) {
        setError('Error en el entorno de ejecución. Intenta reiniciar el sistema.');
      } else {
        // Limpiar el mensaje de error de información técnica innecesaria
        const cleanedError = errorMessage
          .replace(/^Error:\s*/i, '')
          .replace(/^Execution failed\s*/i, '')
          .trim();
        setError(cleanedError || 'Error durante la ejecución del código');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
       
          <TabBar
            tabs={tabs}
            onTabClick={handleTabSwitch}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
            onTabRename={handleTabRename}
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
      
      <main className="app-main">
        <SplitView
          leftPanel={
            <EditorPanel
              ref={editorRef}
              activeTab={activeTab}
              onContentChange={handleContentChange}
              onSelectionChange={setHasSelection}
              onCursorMove={setCursorPosition}
              onFocusChange={setEditorFocused}
              onRunCode={handleRunCode}
            />
          }
          rightPanel={
            <ResultsPanel
              output={output}
              error={error}
              isRunning={isRunning}
              isInitializing={isInitializing}
              initError={initError}
              onRetry={retryInitialization}
              onHardReset={hardReset}
              onClear={handleClearError}
            />
          }
          defaultSplitRatio={splitRatio}
          minLeftWidth={300}
          minRightWidth={300}
          onSplitChange={handleSplitChange}
          className="app-split-view"
        />
      </main>
      
      <footer className="app-footer">
        <div className="footer-left">
          <button 
            className="run-btn" 
            onClick={handleRunCode}
            disabled={isRunning || !runner || isInitializing || (runner && !runner.isReady())}
          >
            <span className="btn-icon">▶</span>
            <span className="btn-text">
              {isInitializing ? 'Inicializando...' : 
               !runner ? 'No disponible' :
               runner && !runner.isReady() ? 'No listo' :
               isRunning ? 'Ejecutando...' : 
               'Ejecutar'}
            </span>
          </button>
          
          <button className="stop-btn" disabled={!isRunning}>
            <span className="btn-icon">⏹</span>
          </button>
          
          <button className="save-btn">
            <span className="btn-icon">💾</span>
            <span className="btn-text">Sin guardar</span>
          </button>
          
          <div className="language-indicator">
            <span className="lang-icon">🟢</span>
            <span>LSP</span>
          </div>
          
          {/* Indicador de estado del Runner */}
          <div className="runner-status">
            <span className={`status-icon ${
              isInitializing ? 'initializing' : 
              !runner ? 'error' :
              runner && !runner.isReady() ? 'warning' :
              'ready'
            }`}>
              {isInitializing ? '🔄' : 
               !runner ? '❌' :
               runner && !runner.isReady() ? '⚠️' :
               '✅'}
            </span>
            <span className="status-text">
              {isInitializing ? 'Inicializando' : 
               !runner ? 'Error' :
               runner && !runner.isReady() ? 'No listo' :
               'Listo'}
            </span>
          </div>
        </div>
        
        <div className="footer-right">
          <span className="file-name">
            {activeTab ? `${activeTab.name}.${currentLanguage === 'typescript' ? 'ts' : 'js'}` : 'No file'}
          </span>
          <button className="ai-assistant-btn">
            <span className="ai-icon">🤖</span>
          </button>
        </div>
      </footer>
      
      {/* Global Floating Toolbar */}
      <FloatingToolbar
        visible={toolbarVisible}
        position="bottom-right"
        context={toolbarContext}
        tools={toolbarTools}
        onToggle={handleToolbarToggle}
        onLanguageChange={handleLanguageChange}
        showHeaderControls={true}
        className="app-floating-toolbar"
      />
      
      {/* Stagewise Toolbar - Solo en modo desarrollo */}
      <StagewiseToolbar
        config={{
          plugins: [ReactPlugin]
        }}
      />
    </div>
  );
}

export default App;