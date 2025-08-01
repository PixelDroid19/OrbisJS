import { useState, useCallback } from 'react';
import { LanguageType } from '../../core/editor';
import type { SupportedLanguage } from '../../core/runner/index.js';

interface UseCodeExecutionProps {
  runner: {
    runCode: (code: string, language: SupportedLanguage, options: { filename: string }) => Promise<{
      success: boolean;
      output?: string;
      error?: string;
    }>;
    stopExecution: () => void;
    isReady: () => boolean;
  };
  isInitializing: boolean;
  retryInitialization: () => Promise<void>;
  activeTab: { name: string; language: LanguageType };
  editorRef: React.RefObject<{
    getContent: () => string | undefined;
  }>;
}

export const useCodeExecution = ({
  runner,
  isInitializing,
  retryInitialization,
  activeTab,
  editorRef
}: UseCodeExecutionProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const handleRunCode = useCallback(async () => {
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
      
      const runnerLanguage = languageMap[activeTab.language as LanguageType] || 'javascript';
      const filename = `${activeTab.name}.${activeTab.language === 'typescript' ? 'ts' : 'js'}`;
      
      const result = await runner.runCode(currentContent, runnerLanguage, { filename });
      
      if (result.success) {
        setOutput(result.output ?? '');
      } else {
        // Mostrar tanto el error como la salida para errores detallados
        const errorMessage = result.error || 'Execution failed';
        const fullErrorMessage = result.output 
          ? `${errorMessage}\n\n${result.output}` 
          : errorMessage;
        setError(fullErrorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Manejo específico del error de inicialización
      if (errorMessage.includes('Runner not initialized')) {
        setError('❌ Error de inicialización del Runner. Usa el botón "Reintentar" en la sección de resultados.');
      } else {
        setError('❌ Error de ejecución: ' + errorMessage);
      }
    } finally {
      setIsRunning(false);
    }
  }, [runner, isInitializing, retryInitialization, activeTab, editorRef]);

  const handleStopCode = useCallback(() => {
    if (runner && isRunning) {
      runner.stopExecution();
      setIsRunning(false);
      setOutput(prev => prev + '\n⏹ Ejecución detenida por el usuario');
    }
  }, [runner, isRunning]);

  const detectMissingModules = useCallback((errorMessage: string): string[] => {
    const missingModules: string[] = [];
    
    // Patrones para detectar errores de módulos faltantes
    const patterns = [
      /Cannot find module ['"`]([^'"`]+)['"`]/g,
      /Module not found: Error: Can't resolve ['"`]([^'"`]+)['"`]/g,
      /Error: Cannot resolve module ['"`]([^'"`]+)['"`]/g,
      /ModuleNotFoundError: No module named ['"`]([^'"`]+)['"`]/g
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(errorMessage)) !== null) {
        const moduleName = match[1];
        // Filtrar módulos internos de Node.js y rutas relativas
        if (!moduleName.startsWith('.') && 
            !moduleName.startsWith('/') && 
            !moduleName.includes('node:') &&
            !['fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util'].includes(moduleName)) {
          missingModules.push(moduleName);
        }
      }
    });
    
    // Eliminar duplicados
    return [...new Set(missingModules)];
  }, []);

  return {
    isRunning,
    output,
    error,
    setOutput,
    setError,
    handleRunCode,
    handleStopCode,
    detectMissingModules
  };
};