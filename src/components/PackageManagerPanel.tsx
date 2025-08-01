import React from 'react';

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
}

interface SearchResult {
  name: string;
  version: string;
  description: string;
}

interface PackageManagerPanelProps {
  searchPackage: string;
  onSearch: (query: string) => void;
  packageSearchResults: SearchResult[];
  onInstallPackage: (name: string) => void;
  isInstalling: boolean;
  installedPackages: PackageInfo[];
  onUninstallPackage: (name: string) => void;
  onClose: () => void;
}

const PackageManagerPanel: React.FC<PackageManagerPanelProps> = ({
  searchPackage,
  onSearch,
  packageSearchResults,
  onInstallPackage,
  isInstalling,
  installedPackages,
  onUninstallPackage,
  onClose,
}) => {
  return (
    <div className="package-panel">
      <div className="package-header">
        <h3>Gestión de Paquetes</h3>
        <button className="close-panel-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="package-search">
        <input
          type="text"
          placeholder="Buscar e instalar paquetes..."
          value={searchPackage}
          onChange={(e) => onSearch(e.target.value)}
          className="package-search-input"
        />

        {packageSearchResults.length > 0 && (
          <div className="package-search-results">
            {packageSearchResults.map((pkg) => (
              <div key={pkg.name} className="package-search-item">
                <div className="package-info">
                  <strong>{pkg.name}</strong>
                  <span className="package-version">v{pkg.version}</span>
                  <p className="package-description">{pkg.description}</p>
                </div>
                <button
                  className="install-btn"
                  onClick={() => onInstallPackage(pkg.name)}
                  disabled={isInstalling}
                >
                  {isInstalling ? '⏳' : '➕'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="installed-packages">
        <h4>Paquetes Instalados</h4>
        {installedPackages.length > 0 ? (
          <div className="package-list">
            {installedPackages.map((pkg) => (
              <div key={pkg.name} className="package-item">
                <div className="package-info">
                  <strong>{pkg.name}</strong>
                  <span className="package-version">v{pkg.version}</span>
                  {pkg.description && (
                    <p className="package-description">{pkg.description}</p>
                  )}
                </div>
                <button
                  className="uninstall-btn"
                  onClick={() => onUninstallPackage(pkg.name)}
                  title="Desinstalar paquete"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-packages">
            <p>No hay paquetes instalados</p>
            <small>Busca y agrega paquetes usando el campo de arriba</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageManagerPanel;