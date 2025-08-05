/**
 * useExecutionService - Hook que integra ExecutionService para simplificar ejecución
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WebContainerRunner } from '../../core/runner/WebContainerRunner.js';
import type { LanguageType } from '../../core/editor/index.js';
import type { AutoExecutionManager } from '../../core/runner/auto-execution/AutoExecutionManager.js';
import { ExecutionService, type ExecutionServiceResult, type ExecutionOptions } from '../services/ExecutionService.js';

interface UseExecutionServiceReturn {
  executeCode: (content: string, tabName: string, language: LanguageType, options?: ExecutionOptions) => Promise<ExecutionServiceResult>;
  isExecuting: boolean;
  lastResult: ExecutionServiceResult | null;
  isReady: boolean;
}

/**
 * Hook que proporciona una interfaz simplificada para ejecutar código
 * usando el ExecutionService centralizado
 */
export function useExecutionService(
  runner: WebContainerRunner | null,
  autoExecutionManager?: AutoExecutionManager | null
): UseExecutionServiceReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionServiceResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const executionServiceRef = useRef<ExecutionService | null>(null);

  // Inicializar ExecutionService cuando el runner esté disponible
  useEffect(() => {
    if (runner && runner.isReady()) {
      executionServiceRef.current = new ExecutionService(runner, autoExecutionManager || undefined);
      setIsReady(true);
    } else {
      executionServiceRef.current = null;
      setIsReady(false);
    }
  }, [runner, autoExecutionManager]);

  // Actualizar AutoExecutionManager cuando cambie
  useEffect(() => {
    if (executionServiceRef.current && autoExecutionManager) {
      executionServiceRef.current.setAutoExecutionManager(autoExecutionManager);
    }
  }, [autoExecutionManager]);

  const executeCode = useCallback(async (
    content: string,
    tabName: string,
    language: LanguageType,
    options: ExecutionOptions = {}
  ): Promise<ExecutionServiceResult> => {
    if (!executionServiceRef.current) {
      const errorResult: ExecutionServiceResult = {
        success: false,
        error: 'Servicio de ejecución no disponible'
      };
      setLastResult(errorResult);
      return errorResult;
    }

    setIsExecuting(true);
    
    try {
      const result = await executionServiceRef.current.executeCode(
        content,
        tabName,
        language,
        options
      );
      
      setLastResult(result);
      return result;
    } catch (error) {
      const errorResult: ExecutionServiceResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, []);

  return {
    executeCode,
    isExecuting,
    lastResult,
    isReady: isReady && !!executionServiceRef.current
  };
}