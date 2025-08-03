import { useState, useEffect, useRef, useCallback } from 'react';
import { WebContainerRunner } from '../../core/runner/index.js';

interface UseWebContainerReturn {
  runner: WebContainerRunner | null;
  isInitializing: boolean;
  initError: string;
  retryInitialization: () => Promise<void>;
  hardReset: () => Promise<void>;
}

export function useWebContainer(): UseWebContainerReturn {
  const [runner, setRunner] = useState<WebContainerRunner | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState('');
  
  const initializationAttempted = useRef(false);
  const lastInitAttempt = useRef(0);
  const isMounted = useRef(true);

  const checkForExistingWebContainer = useCallback(() => {
    if (typeof window !== 'undefined') {
      const singleton = (window as any).__ORBIS_WC_SINGLETON__;
      if (singleton?.instance) {
        console.log('⚠️ Detected existing WebContainer instance');
        return true;
      }
    }
    return false;
  }, []);

  const initRunner = useCallback(async () => {
    const now = Date.now();
    
    // Prevent multiple initialization attempts
    if (!isMounted.current || runner || initializationAttempted.current) return;
    
    // Throttle initialization attempts (minimum 5 seconds between attempts)
    if (now - lastInitAttempt.current < 5000) {
      console.log('⏳ Throttling initialization attempt, waiting...');
      return;
    }
    
    initializationAttempted.current = true;
    lastInitAttempt.current = now;
    setIsInitializing(true);
    setInitError('');
    
    try {
      console.log('🚀 Initializing WebContainer Runner...');
      
      // Check for existing instance first
      if (checkForExistingWebContainer()) {
        console.log('🔄 Existing WebContainer detected, performing cleanup...');
        const { WebContainerManager } = await import('../../core/runner/WebContainerManager.js');
        await WebContainerManager.forceCleanup();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const newRunner = new WebContainerRunner();
      
      // Inicialización con timeout personalizado
      const initPromise = newRunner.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Initialization timeout after 30 seconds')), 30000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      
      if (!isMounted.current) {
        await newRunner.cleanup();
        return;
      }
      
      // Verificación adicional de que el runner está realmente listo
      if (!newRunner.isReady()) {
        throw new Error('Runner initialized but not ready');
      }
      
      setRunner(newRunner);
      setIsInitializing(false);
      console.log('✅ WebContainer Runner initialized successfully');
      
    } catch (err) {
      if (!isMounted.current) return;
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ WebContainer initialization failed:', errorMessage);
      
      setIsInitializing(false);
      initializationAttempted.current = false; // Allow retry
      
      // Handle specific WebContainer singleton errors
      if (errorMessage.includes('single WebContainer instance') || 
          errorMessage.includes('WebContainer singleton error') ||
          errorMessage.includes('Unable to create more instances') ||
          errorMessage.includes('initialization too frequent')) {
        setInitError('🔄 WebContainer se está inicializando demasiado frecuentemente. Espera 10 segundos y usa "Reintentar".');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('failed to initialize within timeout') || errorMessage.includes('Initialization timeout')) {
        setInitError('⏱️ WebContainer tardó demasiado en inicializar. Esto puede deberse a problemas de red. Intenta de nuevo o refresca la página.');
      } else if (errorMessage.includes('Runner initialized but not ready')) {
        setInitError('⚠️ WebContainer se inicializó pero no está listo. Intenta "Reintentar" o "Reset Completo".');
      } else {
        setInitError('❌ Error al inicializar WebContainer: ' + errorMessage);
      }
    }
  }, [runner, checkForExistingWebContainer]);

  const retryInitialization = useCallback(async () => {
    const now = Date.now();
    
    // Prevent multiple retry attempts and enforce minimum wait time
    if (isInitializing || (now - lastInitAttempt.current < 10000)) {
      setInitError('⏳ Espera al menos 10 segundos entre intentos de inicialización.');
      return;
    }
    
    // Reset flags for retry
    initializationAttempted.current = false;
    lastInitAttempt.current = now;
    setIsInitializing(true);
    setInitError('');
    
    try {
      console.log('🔄 Retrying WebContainer initialization...');
      
      // Cleanup current runner if exists
      if (runner) {
        await runner.cleanup();
        setRunner(null);
      }
      
      // Aggressive cleanup
      const { WebContainerManager } = await import('../../core/runner/WebContainerManager.js');
      console.log('🧹 Performing cleanup...');
      await WebContainerManager.forceCleanup();
      
      // Wait longer to prevent frequent initialization
      console.log('⏳ Waiting for cleanup to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try to initialize fresh
      console.log('🚀 Creating new WebContainer instance...');
      const newRunner = new WebContainerRunner();
      await newRunner.initialize();
      
      setRunner(newRunner);
      setIsInitializing(false);
      setInitError('');
      initializationAttempted.current = true; // Mark as successful
      console.log('✅ WebContainer retry successful!');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('❌ Retry failed:', errorMessage);
      
      if (errorMessage.includes('single WebContainer instance') || 
          errorMessage.includes('WebContainer singleton error') ||
          errorMessage.includes('Unable to create more instances') ||
          errorMessage.includes('initialization too frequent')) {
        setInitError('🚫 WebContainer se está inicializando demasiado frecuentemente. Espera 30 segundos antes de reintentar o refresca la página (F5).');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('failed to initialize within timeout')) {
        setInitError('⏱️ WebContainer tardó demasiado en reinicializar. Problemas de red detectados. Refresca la página (F5).');
      } else {
        setInitError('❌ Error al reintentar inicialización: ' + errorMessage);
      }
      setIsInitializing(false);
    }
  }, [isInitializing, runner]);

  const hardReset = useCallback(async () => {
    setIsInitializing(true);
    setInitError('');
    
    try {
      console.log('🔄 Performing hard reset...');
      
      // Destroy current runner
      if (runner) {
        await runner.cleanup();
        setRunner(null);
      }
      
      // Ultra cleanup
      const { WebContainerManager } = await import('../../core/runner/WebContainerManager.js');
      await WebContainerManager.forceCleanup();
      
      // Wait and reload
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload the page
      window.location.reload();
      
    } catch (err) {
      console.error('❌ Hard reset failed:', err);
      setInitError('❌ Error en hard reset. Refresca manualmente con F5.');
      setIsInitializing(false);
    }
  }, [runner]);

  useEffect(() => {
    isMounted.current = true;
    
    // Add cleanup listener for page unload
    const handleBeforeUnload = async () => {
      try {
        const { WebContainerManager } = await import('../../core/runner/WebContainerManager.js');
        await WebContainerManager.forceCleanup();
      } catch (error) {
        console.warn('Cleanup on page unload failed:', error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Only initialize if we don't have a runner yet and haven't attempted
    if (!runner && !initializationAttempted.current) {
      const initTimeout = setTimeout(() => {
        initRunner();
      }, 1000); // Delay to prevent immediate initialization

      return () => {
        clearTimeout(initTimeout);
      };
    }

    return () => {
      isMounted.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (runner) {
        runner.cleanup().catch(console.error);
      }
    };
  }, []); // Empty dependency array to run only once

  return {
    runner,
    isInitializing,
    initError,
    retryInitialization,
    hardReset
  };
}