import React from 'react';
import { ReadOnlyEditorComponent } from '../../core/editor/ReadOnlyEditorComponent';

interface ResultsSectionProps {
  initError: string | null;
  output: string;
  error: string;
  onInstallPackage: (packageName: string) => void;
  isInstalling: boolean;
  detectMissingModules: (errorMessage: string) => string[];
}

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  initError,
  output,
  error,
  onInstallPackage,
  isInstalling,
  detectMissingModules
}) => {
  return (
    <div className="results-section">
      <div className="results-content">
        {initError ? (
          <ReadOnlyEditorComponent
            content={`Error de Inicialización: ${initError}`}
            language="text"
            theme="dark"
            style={{ height: '100%' }}
          />
        ) : output || error ? (
          <>
            <ReadOnlyEditorComponent
              content={error || output || ''}
              language="text"
              theme="dark"
              style={{ height: '100%' }}
            />
            {error && (() => {
              const detectedModules = detectMissingModules(error);
              return detectedModules.length > 0 && (
                <div className="missing-modules-section">
                  <div className="missing-modules-header">
                    <span className="modules-icon">📦</span>
                    <span>Módulos faltantes detectados:</span>
                  </div>
                  <div className="missing-modules-list">
                    {detectedModules.map((moduleName) => (
                      <div key={moduleName} className="missing-module-item">
                        <span className="module-name">{moduleName}</span>
                        <button 
                          className="install-missing-btn"
                          onClick={() => onInstallPackage(moduleName)}
                          disabled={isInstalling}
                          title={`Instalar ${moduleName}`}
                        >
                          {isInstalling ? '⏳' : '📦 Instalar'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <ReadOnlyEditorComponent
            content="Ejecuta tu código para ver los resultados aquí"
            language="text"
            theme="dark"
            style={{ height: '100%' }}
          />
        )}
      </div>
    </div>
  );
};