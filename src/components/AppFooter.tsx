import React from 'react';
import { LanguageType } from '../../core/editor';

interface AppFooterProps {
  onRunCode: () => void;
  onStopCode: () => void;
  onSaveCode: () => void;
  isRunning: boolean;
  runner: {
    isReady: () => boolean;
  } | null;
  isInitializing: boolean;
  currentLanguage: LanguageType;
  onLanguageChange: (language: LanguageType) => void;
  onTogglePackagePanel: () => void;
  missingModulesCount: number;
  activeTab: { name: string } | null;
}

export const AppFooter: React.FC<AppFooterProps> = ({
  onRunCode,
  onStopCode,
  onSaveCode,
  isRunning,
  runner,
  isInitializing,
  currentLanguage,
  onLanguageChange,
  onTogglePackagePanel,
  missingModulesCount,
  activeTab
}) => {
  return (
    <footer className="app-footer">
      <div className="footer-left">
        <button 
          className="run-btn" 
          onClick={onRunCode}
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
        
        <button 
          className="stop-btn" 
          onClick={onStopCode}
          disabled={!isRunning}
        >
          <span className="btn-icon">⏹</span>
        </button>
        
        <button 
          className="save-btn"
          onClick={onSaveCode}
        >
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

        {/* Selector de lenguaje */}
        <div className="language-selector-footer">
          <select 
            value={currentLanguage} 
            onChange={(e) => onLanguageChange(e.target.value as LanguageType)}
            className="language-select-footer"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="json">JSON</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
          </select>
        </div>

        {/* Botón de gestión de paquetes NPM */}
        <div className="packages-section-footer">
          <button 
            className="packages-btn-footer" 
            title="Gestión de Paquetes NPM"
            onClick={onTogglePackagePanel}
          >
            📦 {missingModulesCount}
          </button>
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
  );
};