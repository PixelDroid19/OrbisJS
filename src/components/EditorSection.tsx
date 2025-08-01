import { forwardRef } from 'react';
import { EditorComponent, EditorComponentRef, LanguageType } from '../../core/editor';
import { FloatingToolbar } from './FloatingToolbar';
import PackageManagerPanel from './PackageManagerPanel';

interface EditorSectionProps {
  activeTab: boolean;
  currentContent: string;
  currentLanguage: LanguageType;
  onContentChange: (content: string) => void;
  showPackagePanel: boolean;
  onTogglePackagePanel: () => void;
  installedPackages: Array<{name: string, version: string, description?: string}>;
  onRunCode: () => void;
  onStopCode: () => void;
  onSaveCode: () => void;
  isRunning: boolean;
  // Package panel props
  searchPackage: string;
  onSearchPackages: (query: string) => void;
  packageSearchResults: Array<{name: string, version: string, description: string}>;
  onInstallPackage: (packageName: string) => void;
  isInstalling: boolean;
  onUninstallPackage: (packageName: string) => void;
}

export const EditorSection = forwardRef<EditorComponentRef, EditorSectionProps>(({
  activeTab,
  currentContent,
  currentLanguage,
  onContentChange,
  showPackagePanel,
  onTogglePackagePanel,
  installedPackages,
  onRunCode,
  onStopCode,
  onSaveCode,
  isRunning,
  searchPackage,
  onSearchPackages,
  packageSearchResults,
  onInstallPackage,
  isInstalling,
  onUninstallPackage
}, ref) => {
  return (
    <div className="editor-section">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          {/* Selector de lenguaje movido al footer */}
        </div>
        <div className="toolbar-right">
          <button 
            className="packages-btn" 
            onClick={onTogglePackagePanel}
            title="Gestión de Paquetes NPM"
          >
            📦 {installedPackages.length}
          </button>
        </div>
      </div>
      
      <div className="editor-container">
        <div className={`editor-wrapper ${showPackagePanel ? 'with-panel' : ''}`}>
          {activeTab && (
            <EditorComponent
              ref={ref}
              initialContent={currentContent}
              language={currentLanguage}
              onChange={onContentChange}
              config={{
                theme: 'dark',
                fontSize: 14,
                tabSize: 2,
                lineNumbers: true,
                wordWrap: false,
                autoComplete: true,
                linting: true
              }}
              className="main-editor"
              style={{ height: '100%', width: '100%' }}
            />
          )}

          <FloatingToolbar
            onRun={onRunCode}
            onStop={onStopCode}
            onSave={onSaveCode}
            onTogglePackages={onTogglePackagePanel}
            isRunning={isRunning}
            installedPackagesCount={installedPackages.length}
            placement="bottom"
          />
        </div>
        
        {showPackagePanel && (
          <PackageManagerPanel
            searchPackage={searchPackage}
            onSearch={onSearchPackages}
            packageSearchResults={packageSearchResults}
            onInstallPackage={onInstallPackage}
            isInstalling={isInstalling}
            installedPackages={installedPackages}
            onUninstallPackage={onUninstallPackage}
            onClose={() => onTogglePackagePanel()}
          />
        )}
      </div>
    </div>
  );
});