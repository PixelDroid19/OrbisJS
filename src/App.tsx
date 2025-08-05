import { useState, useRef, useMemo, useCallback } from 'react';
import { EditorComponentRef, LanguageType } from '../core/editor';
import { useTabs } from './hooks/useTabs';
import { useWebContainer } from './hooks/useWebContainer';
import { useAutoExecution } from './hooks/useAutoExecution';
import { useExecutionService } from './hooks/useExecutionService';
import { generateFileNameFromEditorLanguage } from './utils/FileUtils.js';
import { TabBar } from './components/TabBar';
import SplitView from './components/SplitView';
import EditorPanel from './components/EditorPanel';
import ResultsPanel from './components/ResultsPanel';
import FloatingToolbar, { ToolbarContext } from './components/FloatingToolbar';
import AutoExecutionPanel from './components/AutoExecutionPanel';
import AutoExecutionSettings from './components/AutoExecutionSettings';
import ExecutionStatusIndicator from './components/ExecutionStatusIndicator';
import { StagewiseToolbar } from '@stagewise/toolbar-react';
import ReactPlugin from '@stagewise-plugins/react';
import './App.css';
import './editor-fixes.css';

// Testing auto-execution debug logs - change 4 - testing result display
console.log('Auto-execution test - this should appear in results panel');

function App() {
  const { tabs, activeTab, createTab, closeTab, switchTab, updateTab, renameTab } = useTabs();
  const { runner, isInitializing, initError, retryInitialization, hardReset } = useWebContainer();
  const {
    autoExecutionManager,
    isEnabled: autoExecutionEnabled,
    status: autoExecutionStatus,
    progress: autoExecutionProgress,
    toggle: toggleAutoExecution,
    executeNow: executeAutoNow,
    handleFileChange
  } = useAutoExecution(runner, {
    enabled: true,
    debounceDelay: 1000,
    strategy: { type: 'debounced', delay: 1000, priority: 'speed' }
  }, {
    onExecutionStart: () => {
      console.log('🚀 Auto-execution started');
      setIsRunning(true);
      setError(''); // Clear previous errors
    },
    onExecutionResult: (result) => {
      console.log('📊 Auto-execution result:', result);
      if (result.success) {
        setOutput(result.output || 'Code executed successfully via auto-execution');
        setError('');
      } else {
        setError(result.error || 'Error during auto-execution');
        setOutput('');
      }
    },
    onExecutionEnd: () => {
      console.log('✅ Auto-execution ended');
      setIsRunning(false);
    }
  });

  // Servicio centralizado de ejecución
  const { executeCode, isExecuting, isReady: executionServiceReady } = useExecutionService(runner, autoExecutionManager);
  
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [splitRatio, setSplitRatio] = useState(0.6);
  const [editorFocused, setEditorFocused] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [panelWidth] = useState(0);
  const [showAutoExecutionPanel, setShowAutoExecutionPanel] = useState(false);
  const [showAutoExecutionSettings, setShowAutoExecutionSettings] = useState(false);

  const editorRef = useRef<EditorComponentRef>(null);
  
  // Current tab state
  const currentLanguage = activeTab?.language || 'javascript';

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
      
      console.log('📝 Content changed for tab:', activeTab.name, 'Auto-execution enabled:', autoExecutionEnabled);
      console.log('📊 Auto-execution status:', autoExecutionStatus);
      console.log('🔧 AutoExecutionManager available:', !!autoExecutionManager);
      
      // Trigger auto-execution if enabled
      if (autoExecutionEnabled && activeTab.name) {
        // Usar utilidades centralizadas para generar el nombre del archivo
        const filename = generateFileNameFromEditorLanguage(activeTab.name, activeTab.language);
        console.log('🚀 Triggering auto-execution for:', filename);
        console.log('📄 Content length:', newContent.length);
        handleFileChange(filename, newContent, 'modified');
      } else {
        console.log('⏸️ Auto-execution not triggered:', { 
          enabled: autoExecutionEnabled, 
          hasName: !!activeTab.name,
          tabName: activeTab.name,
          managerAvailable: !!autoExecutionManager
        });
      }
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

  // Funciones memoizadas para las acciones del panel
  const handleStopCode = useCallback(() => {
    // TODO: Implementar función para detener ejecución
    console.log('Stop code execution');
  }, []);

  const handleSaveFile = useCallback(() => {
    // TODO: Implementar función para guardar archivo
    console.log('Save file');
  }, []);

  const handleOpenAIAssistant = useCallback(() => {
    // TODO: Implementar función para abrir asistente AI
    console.log('Open AI Assistant');
  }, []);

  const handleClearError = () => {
    setError('');
  };

  const handleRunCode = useCallback(async () => {
    const currentContent = editorRef.current?.getContent();
    if (!currentContent || !activeTab) return;
    
    // Verificaciones básicas usando el servicio centralizado
    if (!executionServiceReady) {
      if (isInitializing) {
        setError('⏳ Runner se está inicializando. Por favor, espera un momento...');
      } else if (!runner) {
        setError('❌ Runner no está disponible. Por favor, espera a que se complete la inicialización o usa "Reintentar".');
      } else {
        setError('⚠️ Servicio de ejecución no está listo. Intentando reinicializar...');
        try {
          await retryInitialization();
          return;
        } catch (err) {
          setError('❌ Error al reinicializar el Runner: ' + (err instanceof Error ? err.message : String(err)));
          return;
        }
      }
      return;
    }

    setIsRunning(true);
    setOutput('');
    setError('');

    try {
      // Usar el servicio centralizado que maneja detección de lenguaje y ejecución
      const result = await executeCode(currentContent, activeTab.name, currentLanguage, {
        useAutoExecution: autoExecutionEnabled && !!executeAutoNow
      });
      
      if (result.success) {
        setOutput(result.output || 'Code executed successfully');
        console.log('🔍 Lenguaje detectado:', result.detectedLanguage);
        if (result.detectedFramework) {
          console.log('🎯 Framework detectado:', result.detectedFramework);
        }
      } else {
        setError(result.error || 'Error durante la ejecución');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Error durante la ejecución del código');
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, executionServiceReady, isInitializing, runner, retryInitialization, currentLanguage, executeCode, autoExecutionEnabled, executeAutoNow]);

  // Memoizar el estado del runner para evitar re-renders
  const runnerStatus = useMemo(() => ({
    isInitializing,
    isReady: runner ? runner.isReady() : false,
    hasError: !!initError
  }), [isInitializing, runner, initError]);

  // Memoizar el nombre del archivo actual
  const currentFileName = useMemo(() => 
    activeTab ? generateFileNameFromEditorLanguage(activeTab.name, currentLanguage) : 'No file',
    [activeTab, currentLanguage]
  );

  // Actions para el FloatingToolbar (memoizado de forma estable para evitar re-renders)
  const actionPanelData = useMemo(() => ({
    onRunCode: handleRunCode,
    onStopCode: handleStopCode,
    onSaveFile: handleSaveFile,
    onToggleAutoExecution: toggleAutoExecution,
    onOpenAIAssistant: handleOpenAIAssistant,
    runnerStatus,
    isRunning,
    isSaved: false, // TODO: Implementar lógica de guardado
    currentFileName,
    autoExecutionEnabled,
    // Solo incluir autoExecutionStatus y autoExecutionProgress cuando realmente cambien de estado significativo
    autoExecutionStatus: autoExecutionStatus?.status || 'idle',
    autoExecutionProgress: autoExecutionProgress?.percentage || 0,
    autoExecutionManager
  }), [
    handleRunCode,
    handleStopCode,
    handleSaveFile,
    toggleAutoExecution,
    handleOpenAIAssistant,
    runnerStatus,
    isRunning,
    currentFileName,
    autoExecutionEnabled,
    autoExecutionStatus?.status, // Solo el status, no todo el objeto
    Math.floor((autoExecutionProgress?.percentage || 0) / 10) * 10, // Redondear a decenas para evitar updates frecuentes
    autoExecutionManager
  ]);

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
    
    // Add auto-execution toggle
    tools.push({
      id: 'auto-execution',
      icon: autoExecutionEnabled ? '⏸️' : '🔄',
      label: autoExecutionEnabled ? 'Disable Auto-execution' : 'Enable Auto-execution',
      action: () => {
        console.log('🔄 Auto-execution toggle clicked, current state:', autoExecutionEnabled);
        toggleAutoExecution();
      },
      visible: true,
      disabled: !runner || isInitializing || (runner && !runner.isReady()),
      tooltip: autoExecutionEnabled ? 'Disable automatic code execution' : 'Enable automatic code execution'
    });
    
    // Add auto-execution panel toggle
    tools.push({
      id: 'auto-execution-panel',
      icon: '⚙️',
      label: 'Auto-execution Panel',
      action: () => setShowAutoExecutionPanel(!showAutoExecutionPanel),
      visible: true,
      disabled: false,
      tooltip: 'Show/hide auto-execution panel'
    });

    // Add debug auto-execution button (temporary)
    tools.push({
      id: 'debug-auto-execution',
      icon: '🐛',
      label: 'Debug Auto-execution',
      action: async () => {
        console.log('🐛 Debug auto-execution triggered');
        console.log('AutoExecutionManager:', autoExecutionManager);
        console.log('Is enabled:', autoExecutionEnabled);
        console.log('Status:', autoExecutionStatus);
        console.log('Active tab:', activeTab);
        
        if (activeTab && autoExecutionManager) {
          const filename = generateFileNameFromEditorLanguage(activeTab.name, activeTab.language);
          console.log('Triggering manual execution for:', filename);
          
          try {
            const result = await executeAutoNow(filename, activeTab.content);
            console.log('✅ Debug execution completed:', result);
          } catch (error) {
            console.error('❌ Debug execution failed:', error);
          }
        }
      },
      visible: true,
      disabled: false,
      tooltip: 'Debug auto-execution functionality'
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
  }, [activeTab, isRunning, runner, isInitializing, autoExecutionEnabled, handleRunCode, toggleAutoExecution, showAutoExecutionPanel, autoExecutionManager, autoExecutionStatus, executeAutoNow]);

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
          <div className="footer-info">
            <span className="footer-info-text">
              Usa el toolbar flotante (⚙️) para acceder a todas las acciones
            </span>
          </div>
        </div>
        
        <div className="footer-right">
          <span className="file-name">
            {activeTab ? generateFileNameFromEditorLanguage(activeTab.name, currentLanguage) : 'No file'}
          </span>
          <div className="footer-status-compact">
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
          </div>
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
        actionPanelData={actionPanelData}
      />
      
      {/* Auto-execution Panel */}
      {showAutoExecutionPanel && (
        <div className="auto-execution-overlay">
          <div className="auto-execution-overlay-backdrop" onClick={() => setShowAutoExecutionPanel(false)} />
          <div className="auto-execution-overlay-content">
            <AutoExecutionPanel
              autoExecutionManager={autoExecutionManager}
              className="app-auto-execution-panel"
            />
            <div className="auto-execution-overlay-actions">
              <button
                className="overlay-btn overlay-btn--secondary"
                onClick={() => setShowAutoExecutionSettings(true)}
              >
                Settings
              </button>
              <button
                className="overlay-btn overlay-btn--primary"
                onClick={() => setShowAutoExecutionPanel(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Auto-execution Settings */}
      {showAutoExecutionSettings && (
        <div className="settings-overlay">
          <div className="settings-overlay-backdrop" onClick={() => setShowAutoExecutionSettings(false)} />
          <div className="settings-overlay-content">
            <AutoExecutionSettings
              autoExecutionManager={autoExecutionManager}
              onClose={() => setShowAutoExecutionSettings(false)}
              className="app-auto-execution-settings"
            />
          </div>
        </div>
      )}

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