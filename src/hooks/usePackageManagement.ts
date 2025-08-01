import { useState, useEffect, useCallback } from 'react';

interface UsePackageManagementProps {
  runner: {
    getPackageManager: () => {
      on: (event: string, callback: (data: { packageName: string; error?: string }) => void) => void;
      off: (event: string, callback: (data: { packageName: string; error?: string }) => void) => void;
      getInstalledPackages: () => Promise<Array<{name: string, version: string, description?: string}>>;
    };
    isReady?: () => boolean;
    getInstalledPackages: () => Array<{name: string, version: string, description?: string}>;
    installPackage: (packageName: string) => Promise<void>;
    removePackage: (packageName: string) => Promise<void>;
  };
  setOutput: (value: string | ((prev: string) => string)) => void;
  setError: (value: string) => void;
}

export const usePackageManagement = ({
  runner,
  setOutput,
  setError
}: UsePackageManagementProps) => {
  const [installedPackages, setInstalledPackages] = useState<Array<{name: string, version: string, description?: string}>>([]);
  const [searchPackage, setSearchPackage] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [packageSearchResults, setPackageSearchResults] = useState<Array<{name: string, version: string, description: string}>>([]);
  const [missingModules, setMissingModules] = useState<string[]>([]);

  // Load installed packages
  useEffect(() => {
    if (runner && runner.getPackageManager) {
      const packageManager = runner.getPackageManager();
      if (packageManager) {
        const loadPackages = async () => {
          try {
            const packages = await packageManager.getInstalledPackages();
            setInstalledPackages(packages);
          } catch (err) {
            console.error('Error loading packages:', err);
          }
        };
        loadPackages();

        // Listen for package changes
        const handlePackageUpdate = () => {
          loadPackages();
        };

        packageManager.on('packageInstalled', handlePackageUpdate);
        packageManager.on('packagesLoaded', handlePackageUpdate);

        return () => {
          packageManager.off('packageInstalled', handlePackageUpdate);
          packageManager.off('packagesLoaded', handlePackageUpdate);
        };
      }
    } else if (runner && runner.isReady && runner.isReady()) {
      // Fallback: load packages directly from runner when ready
      loadInstalledPackages();
    }
  }, [runner]);

  const loadInstalledPackages = useCallback(async () => {
    if (!runner) return;
    
    try {
      const packages = runner.getInstalledPackages();
      setInstalledPackages(packages);
      console.log(`📦 Cargados ${packages.length} paquetes instalados`);
    } catch (err) {
      console.error('Error cargando paquetes instalados:', err);
    }
  }, [runner]);

  const handleInstallPackage = useCallback(async (packageName: string) => {
    if (!runner) {
      setError('❌ Runner no disponible');
      return;
    }
    
    setIsInstalling(true);
    setError('');
    
    try {
      console.log(`🚀 Iniciando instalación de: ${packageName}`);
      
      // Obtener el package manager y configurar eventos
      const packageManager = runner.getPackageManager();
      if (!packageManager) {
        throw new Error('PackageManager no inicializado');
      }

      // Escuchar eventos del PackageManager
      packageManager.on('installStarted', (data: any) => {
        console.log('📦 Instalación iniciada:', data);
        setOutput(prev => prev + `\n📦 Instalando ${data.packageName}...`);
      });

      packageManager.on('installCompleted', (data: any) => {
        console.log('✅ Instalación completada:', data);
        setOutput(prev => prev + `\n✅ ${data.packageName} instalado exitosamente`);
      });

      packageManager.on('installFailed', (data: any) => {
        console.error('❌ Error de instalación:', data);
        setError(`Error al instalar ${data.packageName}: ${data.error}`);
      });

      // Usar el método directo del runner
      await runner.installPackage(packageName);
      
      // Recargar paquetes instalados
      await loadInstalledPackages();
      
      // Limpiar búsqueda
      setSearchPackage('');
      setPackageSearchResults([]);
      
      console.log(`✅ Paquete ${packageName} instalado exitosamente`);
      
    } catch (err) {
      const errorMsg = `❌ Error instalando ${packageName}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      setError(errorMsg);
      setOutput(prev => prev + '\n' + errorMsg);
    } finally {
      setIsInstalling(false);
    }
  }, [runner, setError, setOutput, loadInstalledPackages]);

  const handleUninstallPackage = useCallback(async (packageName: string) => {
    if (!runner) {
      setError('❌ Runner no disponible');
      return;
    }
    
    try {
      console.log(`🗑️ Desinstalando paquete: ${packageName}`);
      await runner.removePackage(packageName);
      await loadInstalledPackages();
      console.log(`✅ Paquete ${packageName} desinstalado exitosamente`);
    } catch (err) {
      const errorMsg = `❌ Error desinstalando ${packageName}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      setError(errorMsg);
    }
  }, [runner, setError, loadInstalledPackages]);

  const handleSearchPackages = useCallback(async (query: string) => {
    setSearchPackage(query);
    if (query.length < 2) {
      setPackageSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=20`);
      const data = await response.json();
      const results = data.objects.map((obj: any) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description || ''
      }));
      setPackageSearchResults(results);
    } catch (err) {
      console.error('Error searching packages:', err);
      setPackageSearchResults([]);
    }
  }, []);

  return {
    installedPackages,
    searchPackage,
    isInstalling,
    packageSearchResults,
    missingModules,
    setMissingModules,
    handleInstallPackage,
    handleUninstallPackage,
    handleSearchPackages
  };
};