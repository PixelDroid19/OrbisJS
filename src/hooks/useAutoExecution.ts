
import { useState, useEffect, useCallback, useRef } from 'react';
import { AutoExecutionManager } from '../../core/runner/auto-execution/AutoExecutionManager.js';
import type { WebContainerRunner } from '../../core/runner/WebContainerRunner.js';
import type { 
  FileChangeEvent, 
  ExecutionStatus, 
  ExecutionProgress,
  ExecutionStrategy,
  AutoExecutionConfig 
} from '../../core/runner/auto-execution/types.js';

interface UseAutoExecutionOptions {
  enabled?: boolean;
  debounceDelay?: number;
  strategy?: ExecutionStrategy;
}

interface UseAutoExecutionReturn {
  autoExecutionManager: AutoExecutionManager | null;
  isEnabled: boolean;
  status: ExecutionStatus;
  progress: ExecutionProgress | null;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  executeNow: (filePath?: string, content?: string) => Promise<void>;
  cancelExecution: () => void;
  setStrategy: (strategy: ExecutionStrategy) => void;
  setDebounceDelay: (delay: number) => void;
  handleFileChange: (filePath: string, content: string, changeType?: 'created' | 'modified' | 'deleted') => void;
}

const DEFAULT_OPTIONS: UseAutoExecutionOptions = {
  enabled: true,
  debounceDelay: 1000,
  strategy: {
    type: 'debounced',
    delay: 1000,
    priority: 'speed'
  }
};

export interface AutoExecutionCallbacks {
  onExecutionResult?: (result: { success: boolean; output?: string; error?: string }) => void;
  onExecutionStart?: () => void;
  onExecutionEnd?: () => void;
}

export function useAutoExecution(
  runner: WebContainerRunner | null,
  options: AutoExecutionOptions = {},
  callbacks?: AutoExecutionCallbacks
): UseAutoExecutionReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [autoExecutionManager, setAutoExecutionManager] = useState<AutoExecutionManager | null>(null);
  const [isEnabled, setIsEnabled] = useState(opts.enabled || false);
  const [status, setStatus] = useState<ExecutionStatus>({
    isRunning: false,
    queuedFiles: [],
    executionCount: 0
  });
  const [progress, setProgress] = useState<ExecutionProgress | null>(null);
  
  const statusUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Store options in ref to avoid dependency issues
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Initialize AutoExecutionManager when runner is ready
  useEffect(() => {
    if (!runner) {
      console.log('⚠️ No runner available, cannot initialize AutoExecutionManager');
      setAutoExecutionManager(null);
      return;
    }

    if (!runner.isReady()) {
      console.log('⚠️ Runner not ready, cannot initialize AutoExecutionManager');
      setAutoExecutionManager(null);
      return;
    }

    // Prevent re-initialization if manager already exists and runner hasn't changed
    if (autoExecutionManager && autoExecutionManager.runner === runner) {
      console.log('🔄 AutoExecutionManager already initialized for this runner');
      return;
    }

    console.log('🔄 Initializing AutoExecutionManager with runner...');
    
    const config: Partial<AutoExecutionConfig> = {
      enabled: optsRef.current.enabled,
      debounceDelay: optsRef.current.debounceDelay,
      strategy: optsRef.current.strategy
    };

    console.log('⚙️ AutoExecutionManager config:', config);

    try {
      const manager = new AutoExecutionManager(runner, config);
      
      // Set up event listeners with proper cleanup
      const beforeExecutionCallback = async (entry: any) => {
        console.log(`🚀 About to execute: ${entry.filePath}`);
        callbacks?.onExecutionStart?.();
        return true; // Continue execution
      };

      const afterExecutionCallback = async (entry: any, result: any) => {
        console.log(`✅ Executed ${entry.filePath}:`, result.success ? 'Success' : 'Failed');
        
        // Notify the application about the execution result
        if (callbacks?.onExecutionResult) {
          callbacks.onExecutionResult({
            success: result.success,
            output: result.output,
            error: result.error
          });
        }
        
        callbacks?.onExecutionEnd?.();
        
        if (!result.success && result.error) {
          console.error('Execution error:', result.error);
        }
      };

      const executionErrorCallback = async (entry: any, error: any) => {
        console.error(`❌ Execution error for ${entry.filePath}:`, error);
        
        // Notify the application about the execution error
        if (callbacks?.onExecutionResult) {
          callbacks.onExecutionResult({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        callbacks?.onExecutionEnd?.();
      };

      const progressCallback = (progressData: any) => {
        if (isMountedRef.current) {
          setProgress(progressData);
        }
      };

      manager.onBeforeExecution(beforeExecutionCallback);
      manager.onAfterExecution(afterExecutionCallback);
      manager.onExecutionError(executionErrorCallback);
      manager.onProgress(progressCallback);

      setAutoExecutionManager(manager);
      setIsEnabled(manager.isEnabled());
      
      // If initially enabled, set up auto-execution
      if (optsRef.current.enabled && manager.isEnabled()) {
        console.log('🔄 Setting up initial auto-execution...');
        
        // Use a browser-compatible approach for directory watching
        // In browser environment, we'll use relative paths from the project root
        const watchDir = '/src'; // Watch the src directory
        console.log('👁️ Setting up directory watch for:', watchDir);
        
        manager.watchDirectory(watchDir, {
          includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
          excludePatterns: ['**/node_modules/**', '**/dist/**'],
          recursive: true
        });
        console.log('👁️ Auto-execution watching enabled for:', watchDir);
      }
      
      console.log('✅ AutoExecutionManager initialized successfully');

      return () => {
        console.log('🧹 Cleaning up AutoExecutionManager...');
        // Note: In a real implementation, we might need cleanup methods
      };
    } catch (error) {
      console.error('❌ Failed to initialize AutoExecutionManager:', error);
      setAutoExecutionManager(null);
    }
  }, [runner]); // Only depend on runner, not on opts

  // Set up status polling
  useEffect(() => {
    if (!autoExecutionManager) {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
      return;
    }

    const updateStatus = () => {
      if (isMountedRef.current && autoExecutionManager) {
        const currentStatus = autoExecutionManager.getExecutionStatus();
        setStatus(currentStatus);
        setIsEnabled(autoExecutionManager.isEnabled());
      }
    };

    // Initial update
    updateStatus();

    // Set up polling
    statusUpdateIntervalRef.current = setInterval(updateStatus, 500);

    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
    };
  }, [autoExecutionManager]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
    };
  }, []);

  const enable = useCallback(() => {
    if (autoExecutionManager) {
      console.log('🔄 Enabling auto-execution...');
      autoExecutionManager.enable();
      
      // Use a browser-compatible approach for directory watching
      // In browser environment, we'll use relative paths from the project root
      const watchDir = '/src'; // Watch the src directory
      console.log('👁️ Setting up directory watch for:', watchDir);
      
      // Set up watching for common file patterns
      autoExecutionManager.watchDirectory(watchDir, {
        includePatterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
        excludePatterns: ['**/node_modules/**', '**/dist/**'],
        recursive: true
      });
      
      setIsEnabled(true);
      console.log('✅ Auto-execution enabled for:', watchDir);
    }
  }, [autoExecutionManager]);

  const disable = useCallback(() => {
    if (autoExecutionManager) {
      console.log('⏸️ Disabling auto-execution...');
      autoExecutionManager.disable();
      setIsEnabled(false);
      console.log('✅ Auto-execution disabled');
    }
  }, [autoExecutionManager]);

  const toggle = useCallback(() => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  }, [isEnabled, enable, disable]);

  const executeNow = useCallback(async (filePath?: string, content?: string): Promise<any> => {
    if (!autoExecutionManager) {
      throw new Error('AutoExecutionManager not initialized');
    }
    console.log('🎯 useAutoExecution.executeNow called with:', { filePath, hasContent: !!content });
    return autoExecutionManager.executeNow(filePath, content);
  }, [autoExecutionManager]);

  const cancelExecution = useCallback(() => {
    if (autoExecutionManager) {
      autoExecutionManager.cancelExecution();
    }
  }, [autoExecutionManager]);

  const setStrategy = useCallback((strategy: ExecutionStrategy) => {
    if (autoExecutionManager) {
      autoExecutionManager.setExecutionStrategy(strategy);
    }
  }, [autoExecutionManager]);

  const setDebounceDelay = useCallback((delay: number) => {
    if (autoExecutionManager) {
      autoExecutionManager.setDebounceDelay(delay);
    }
  }, [autoExecutionManager]);

  const handleFileChange = useCallback((
    filePath: string, 
    content: string, 
    changeType: 'created' | 'modified' | 'deleted' = 'modified'
  ) => {
    console.log('🔍 handleFileChange called:', { filePath, changeType, hasManager: !!autoExecutionManager, isEnabled });
    
    if (!autoExecutionManager) {
      console.log('⚠️ AutoExecutionManager not available for file change:', filePath);
      return;
    }

    if (!autoExecutionManager.isEnabled()) {
      console.log('⚠️ Auto-execution is disabled, ignoring file change:', filePath);
      return;
    }

    const event: FileChangeEvent = {
      filePath,
      changeType,
      content,
      timestamp: new Date()
    };

    console.log('📝 Handling file change event:', event);
    autoExecutionManager.handleFileChange(event);
    
    // Debug: Check execution status after handling file change
    setTimeout(() => {
      const currentStatus = autoExecutionManager.getExecutionStatus();
      console.log('📊 Execution status after file change:', currentStatus);
    }, 100);
  }, [autoExecutionManager, isEnabled]);

  return {
    autoExecutionManager,
    isEnabled,
    status,
    progress,
    enable,
    disable,
    toggle,
    executeNow,
    cancelExecution,
    setStrategy,
    setDebounceDelay,
    handleFileChange
  };
}