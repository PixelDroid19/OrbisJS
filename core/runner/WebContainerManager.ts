/**
 * WebContainer Manager - Singleton Pattern Implementation
 * Based on official WebContainer API documentation
 */

import type { WebContainerInstance, SingletonState } from './types.js';

// Global singleton symbol to prevent multiple instances
const SINGLETON_KEY = Symbol.for('__ORBIS_WEBCONTAINER_SINGLETON__');

// Extend global scope
declare global {
  interface Window {
    [SINGLETON_KEY]?: SingletonState;
  }
}

// Custom window type with singleton support
interface OrbisWindow extends Window {
  [SINGLETON_KEY]?: SingletonState;
}

/**
 * WebContainerManager - Singleton manager for WebContainer instances
 * Ensures only one WebContainer instance exists across the application
 */
export class WebContainerManager {
  private static instance: WebContainerManager;
  private state: SingletonState;

  private constructor() {
    // Initialize global state
    const globalState = (typeof window !== 'undefined' ? window : {}) as OrbisWindow;
    
    if (!globalState[SINGLETON_KEY]) {
      globalState[SINGLETON_KEY] = {
        instance: null,
        isBooting: false,
        bootPromise: null,
        bootCount: 0,
        lastBootTime: 0
      };
    }
    
    this.state = globalState[SINGLETON_KEY];
  }

  /**
   * Get the singleton instance of WebContainerManager
   */
  public static getInstance(): WebContainerManager {
    if (!WebContainerManager.instance) {
      WebContainerManager.instance = new WebContainerManager();
    }
    return WebContainerManager.instance;
  }

  /**
   * Get the current WebContainer instance
   */
  public getInstance(): WebContainerInstance | null {
    return this.state.instance;
  }

  /**
   * Check if WebContainer is currently booting
   */
  public isBooting(): boolean {
    return this.state.isBooting;
  }

  /**
   * Initialize WebContainer instance
   * Uses singleton pattern to ensure only one instance exists
   */
  public async initialize(): Promise<WebContainerInstance> {
    // Return existing instance if available
    if (this.state.instance) {
      console.log('✅ Usando instancia existente de WebContainer');
      return this.state.instance;
    }

    // Return existing boot promise if booting
    if (this.state.bootPromise) {
      console.log('⏳ WebContainer ya está inicializando, esperando...');
      return this.state.bootPromise;
    }

    // Prevent rapid reinitialization
    const now = Date.now();
    if (now - this.state.lastBootTime < 2000) {
      throw new Error('WebContainer initialization too frequent');
    }

    console.log('🚀 Inicializando nueva instancia de WebContainer...');
    this.state.isBooting = true;
    this.state.lastBootTime = now;
    this.state.bootCount++;

    this.state.bootPromise = this.bootNewInstance()
      .then(instance => {
        this.state.instance = instance;
        this.state.isBooting = false;
        this.state.bootPromise = null;
        console.log('✅ WebContainer inicializado exitosamente');
        return instance;
      })
      .catch(error => {
        this.state.isBooting = false;
        this.state.bootPromise = null;
        console.error('❌ Error inicializando WebContainer:', error);
        throw error;
      });

    return this.state.bootPromise;
  }

  /**
   * Boot a new WebContainer instance
   */
  private async bootNewInstance(): Promise<WebContainerInstance> {
    try {
      console.log('📦 Cargando WebContainer API...');
      
      // Dynamic import to avoid bundling issues
      const { WebContainer } = await import('@webcontainer/api');
      
      if (!WebContainer) {
        throw new Error('WebContainer API not available');
      }

      console.log('⚡ Iniciando WebContainer...');
      
      // Add timeout to prevent hanging
      const bootPromise = WebContainer.boot();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('WebContainer boot timeout after 30 seconds'));
        }, 30000);
      });

      const instance = await Promise.race([bootPromise, timeoutPromise]);
      
      // Validate instance
      if (!instance || typeof instance.fs !== 'object') {
        throw new Error('Invalid WebContainer instance');
      }

      // Test basic functionality
      try {
        await instance.fs.writeFile('/test.txt', 'test');
        await instance.fs.readFile('/test.txt', 'utf-8');
        await instance.fs.rm('/test.txt');
        console.log('✅ WebContainer validation passed');
      } catch (validationError) {
        console.warn('⚠️ WebContainer validation failed:', validationError);
        // Continue anyway, might still work
      }

      console.log('🎉 WebContainer initialized successfully');
      return instance;
    } catch (error) {
      console.error('💥 WebContainer boot failed:', error);
      
      // Handle singleton error specifically
      if (this.isSingletonError(error)) {
        throw new Error('WebContainer singleton violation detected');
      }
      
      // Handle timeout error
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('WebContainer failed to initialize within timeout period');
      }
      
      throw error;
    }
  }

  /**
   * Check if error is a singleton violation
   */
  private isSingletonError(error: unknown): boolean {
    return error instanceof Error && 
           (error.message.includes('singleton') || 
            error.message.includes('already exists') ||
            error.message.includes('WebContainer'));
  }

  /**
   * Force cleanup of WebContainer instance (static method)
   */
  public static async forceCleanup(): Promise<void> {
    const manager = WebContainerManager.getInstance();
    await manager.forceCleanup();
  }

  /**
   * Force cleanup of WebContainer instance
   */
  public async forceCleanup(): Promise<void> {
    if (this.state.instance) {
      try {
        this.state.instance.teardown();
      } catch (error) {
        console.warn('Error during teardown:', error);
      }
    }

    // Reset state
    this.state.instance = null;
    this.state.isBooting = false;
    this.state.bootPromise = null;

    // Clear global references
    if (typeof window !== 'undefined') {
      delete (window as OrbisWindow)[SINGLETON_KEY];
    }

    // Force garbage collection
    if (globalThis.gc) {
      globalThis.gc();
    }
  }

  /**
   * Get boot statistics
   */
  public getBootStats() {
    return {
      bootCount: this.state.bootCount,
      isBooting: this.state.isBooting,
      hasInstance: this.state.instance !== null,
      lastBootTime: this.state.lastBootTime
    };
  }

  /**
   * Reset the singleton state
   */
  public async reset(): Promise<void> {
    await this.forceCleanup();
    this.state.bootCount = 0;
    this.state.lastBootTime = 0;
  }
}