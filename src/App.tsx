import { useState, useRef, useEffect } from "react";
import { EditorComponentRef, LanguageType } from "../core/editor";
import { useTabs } from "./hooks/useTabs";
import { useWebContainer } from "./hooks/useWebContainer";
import { useCodeExecution } from "./hooks/useCodeExecution";
import { usePackageManagement } from "./hooks/usePackageManagement";
import { AppHeader } from "./components/AppHeader";
import { EditorSection } from "./components/EditorSection";
import { ResultsSection } from "./components/ResultsSection";
import { AppFooter } from "./components/AppFooter";
import { StagewiseToolbar } from "@stagewise/toolbar-react";
import ReactPlugin from "@stagewise-plugins/react";
import "./App.css";
import "./editor-fixes.css";

function App() {
  const {
    tabs,
    activeTab,
    createTab,
    closeTab,
    switchTab,
    updateTab,
    renameTab,
  } = useTabs();
  const { runner, isInitializing, initError, retryInitialization, hardReset } =
    useWebContainer();
  const [showPackagePanel, setShowPackagePanel] = useState(false);

  const editorRef = useRef<EditorComponentRef>(null);

  // Code execution hook
  const {
    isRunning,
    output,
    error,
    setOutput,
    setError,
    handleRunCode,
    handleStopCode,
    detectMissingModules,
  } = useCodeExecution({
    runner,
    isInitializing,
    retryInitialization,
    activeTab,
    editorRef,
  });

  // Package management hook
  const {
    installedPackages,
    searchPackage,
    isInstalling,
    packageSearchResults,
    missingModules,
    setMissingModules,
    handleInstallPackage,
    handleUninstallPackage,
    handleSearchPackages,
  } = usePackageManagement({
    runner,
    setOutput,
    setError,
  });

  // Limpiar módulos faltantes cuando no hay errores
  useEffect(() => {
    if (!error) {
      setMissingModules([]);
    }
  }, [error, setMissingModules]);

  // Current tab state
  const currentLanguage = activeTab?.language || "javascript";
  const currentContent = activeTab?.content || "";

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
        modified: isModified,
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
    createTab(`untitled-${tabs.length + 1}`, "", "javascript");
  };

  const handleTabClose = (tabId: string) => {
    closeTab(tabId);
  };

  const handleTabRename = (tabId: string, newName: string) => {
    renameTab(tabId, newName);
  };

  const handleSaveCode = () => {
    if (activeTab && editorRef.current) {
      const content = editorRef.current.getContent();
      updateTab(activeTab.id, { content, modified: false });

      // Mostrar notificación temporal
      const notification = document.createElement("div");
      notification.textContent = "✅ Código guardado";
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 1001;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    }
  };

  const handleTogglePackagePanel = () => {
    setShowPackagePanel(!showPackagePanel);
  };

  return (
    <div className="app">
      <AppHeader
        tabs={tabs}
        onTabClick={handleTabSwitch}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
        onTabRename={handleTabRename}
      />

      <main className="app-main">
        <EditorSection
          ref={editorRef}
          activeTab={activeTab}
          currentContent={currentContent}
          currentLanguage={currentLanguage}
          onContentChange={handleContentChange}
          showPackagePanel={showPackagePanel}
          onTogglePackagePanel={handleTogglePackagePanel}
          installedPackages={installedPackages}
          onRunCode={handleRunCode}
          onStopCode={handleStopCode}
          onSaveCode={handleSaveCode}
          isRunning={isRunning}
          searchPackage={searchPackage}
          onSearchPackages={handleSearchPackages}
          packageSearchResults={packageSearchResults}
          onInstallPackage={handleInstallPackage}
          isInstalling={isInstalling}
          onUninstallPackage={handleUninstallPackage}
        />

        <ResultsSection
          initError={initError}
          output={output}
          error={error}
          onInstallPackage={handleInstallPackage}
          isInstalling={isInstalling}
          detectMissingModules={detectMissingModules}
        />
      </main>

      <AppFooter
        onRunCode={handleRunCode}
        onStopCode={handleStopCode}
        onSaveCode={handleSaveCode}
        isRunning={isRunning}
        runner={runner}
        isInitializing={isInitializing}
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        onTogglePackagePanel={handleTogglePackagePanel}
        missingModulesCount={missingModules.length}
        activeTab={activeTab}
      />

      {/* Stagewise Toolbar - Solo en modo desarrollo */}
      <StagewiseToolbar
        config={{
          plugins: [ReactPlugin],
        }}
      />
    </div>
  );
}

export default App;
