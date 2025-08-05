/**
 * ExecutionService - Servicio centralizado para ejecución de código
 * Integra LanguageDetector y AutoExecutionManager para eliminar duplicación
 */

import type { WebContainerRunner } from '../../core/runner/WebContainerRunner.js';
import type { ExecutionResult, SupportedLanguage } from '../../core/runner/types.js';
import type { LanguageType } from '../../core/editor/index.js';
import type { ExecutionQueueEntry } from '../../core/runner/auto-execution/types.js';
import { LanguageDetector } from '../../core/runner/babel/LanguageDetector.js';
import { AutoExecutionManager } from '../../core/runner/auto-execution/AutoExecutionManager.js';
import { generateFileName, getLanguageExtension } from '../utils/FileUtils.js';

export interface ExecutionOptions {
  filename?: string;
  useAutoExecution?: boolean;
  timeout?: number;
}

export interface ExecutionServiceResult {
  success: boolean;
  output?: string;
  error?: string;
  detectedLanguage?: string;
  detectedFramework?: string;
}

/**
 * Servicio centralizado para ejecución de código que elimina duplicación
 */
export class ExecutionService {
  private languageDetector: LanguageDetector;
  private autoExecutionManager: AutoExecutionManager | null = null;

  constructor(
    private runner: WebContainerRunner,
    autoExecutionManager?: AutoExecutionManager
  ) {
    this.languageDetector = new LanguageDetector();
    this.autoExecutionManager = autoExecutionManager || null;
  }

  /**
   * Ejecuta código usando detección automática de lenguaje
   */
  async executeCode(
    content: string,
    tabName: string,
    currentLanguage: LanguageType,
    options: ExecutionOptions = {}
  ): Promise<ExecutionServiceResult> {
    try {
      // Verificar que el runner esté listo
      if (!this.runner.isReady()) {
        return {
          success: false,
          error: 'El sistema de ejecución no está listo. Por favor, espera a que se complete la inicialización.'
        };
      }

      // Detectar lenguaje automáticamente del contenido
      const languageInfo = this.languageDetector.detectFromContent(content);
      console.log('🔍 Lenguaje detectado:', languageInfo);

      // Usar currentLanguage como fallback si la detección automática no es confiable
      const finalLanguage = languageInfo.language || currentLanguage || 'javascript';

      // Generar nombre de archivo usando utilidades centralizadas
      const filename = options.filename || generateFileName(tabName, finalLanguage);
      
      // Intentar usar auto-ejecución si está disponible y habilitada
      if (options.useAutoExecution && this.autoExecutionManager) {
        try {
          const result = await this.executeViaAutoExecution(filename, content);
          return {
            success: result.success,
            output: result.output,
            error: result.error,
            detectedLanguage: finalLanguage,
            detectedFramework: languageInfo.framework
          };
        } catch (error) {
          console.warn('Auto-ejecución falló, usando ejecución directa:', error);
          // Continuar con ejecución directa
        }
      }

      // Ejecución directa usando el runner
      const result = await this.executeDirectly(content, finalLanguage, filename, options.timeout);
      
      return {
        success: result.success,
        output: result.output,
        error: result.error,
        detectedLanguage: finalLanguage,
        detectedFramework: languageInfo.framework
      };

    } catch (error) {
      return {
        success: false,
        error: this.formatError(error)
      };
    }
  }

  /**
   * Ejecuta código usando AutoExecutionManager
   */
  private async executeViaAutoExecution(filename: string, content: string): Promise<ExecutionResult> {
    if (!this.autoExecutionManager) {
      throw new Error('AutoExecutionManager no disponible');
    }

    // Simular cambio de archivo para trigger auto-ejecución
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout en auto-ejecución'));
      }, 10000);

      // Bandera para evitar múltiples resoluciones
      let isResolved = false;

      // Configurar callback temporal para capturar resultado
      const tempCallback = async (entry: ExecutionQueueEntry, result: ExecutionResult) => {
        if (entry.filePath === filename && !isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve(result);
        }
      };

      this.autoExecutionManager!.onAfterExecution(tempCallback);
      
      // Trigger ejecución
      this.autoExecutionManager!.handleFileChange({
        filePath: filename,
        content,
        changeType: 'modified',
        timestamp: new Date()
      });
    });
  }

  /**
   * Ejecuta código directamente usando el runner
   */
  private async executeDirectly(
    content: string, 
    language: string, 
    filename: string,
    timeout?: number
  ): Promise<ExecutionResult> {
    const runnerLanguage = this.mapToRunnerLanguage(language);
    
    // Asegurar que el filename tenga la extensión correcta para el lenguaje detectado
    const validatedFilename = this.ensureCorrectExtension(filename, language);
    
    const options = {
      filename: validatedFilename,
      timeout: timeout || 30000
    };

    return await this.runner.runCode(content, runnerLanguage, options);
  }

  /**
   * Asegura que el filename tenga la extensión correcta para el lenguaje
   */
  private ensureCorrectExtension(filename: string, language: string): string {
    const expectedExtension = getLanguageExtension(language);
    
    // Si el archivo ya tiene una extensión
    if (filename.includes('.')) {
      const currentExtension = filename.split('.').pop()?.toLowerCase();
      
      // Si la extensión actual no coincide con la esperada, reemplazarla
      if (currentExtension !== expectedExtension) {
        const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.'));
        return `${nameWithoutExtension}.${expectedExtension}`;
      }
      
      return filename;
    }
    
    // Si no tiene extensión, agregarla
    return `${filename}.${expectedExtension}`;
  }

  /**
   * Mapea lenguaje detectado a lenguaje del runner
   */
  private mapToRunnerLanguage(detectedLanguage: string): SupportedLanguage {
    const languageMap: Record<string, SupportedLanguage> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'json': 'javascript',
      'css': 'javascript',
      'html': 'javascript',
      'vue': 'javascript',
      'svelte': 'javascript'
    };

    return languageMap[detectedLanguage] || 'javascript';
  }

  /**
   * Formatea errores de manera consistente
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message;
      
      // Limpiar mensajes de error comunes
      if (message.includes('Runner not initialized')) {
        return 'El sistema de ejecución no está inicializado. Usa el botón "Reintentar".';
      }
      
      if (message.includes('timeout')) {
        return 'El código tardó demasiado en ejecutarse. Verifica si hay bucles infinitos.';
      }
      
      if (message.includes('WebContainer')) {
        return 'Error en el entorno de ejecución. Intenta reiniciar el sistema.';
      }

      // Limpiar prefijos innecesarios
      return message
        .replace(/^Error:\s*/i, '')
        .replace(/^Execution failed\s*/i, '')
        .trim() || 'Error durante la ejecución del código';
    }

    return String(error) || 'Error desconocido durante la ejecución';
  }

  /**
   * Actualiza el AutoExecutionManager
   */
  setAutoExecutionManager(manager: AutoExecutionManager | null): void {
    this.autoExecutionManager = manager;
  }

  /**
   * Obtiene información detallada sobre la ejecución basada en el contenido
   */
  getExecutionInfo(content: string, tabName: string): {
    detectedLanguage: string;
    expectedExtension: string;
    suggestedFilename: string;
    framework?: string;
  } {
    const languageInfo = this.languageDetector.detectFromContent(content);
    const expectedExtension = getLanguageExtension(languageInfo.language);
    const suggestedFilename = this.ensureCorrectExtension(tabName, languageInfo.language);
    
    return {
      detectedLanguage: languageInfo.language,
      expectedExtension,
      suggestedFilename,
      framework: languageInfo.framework
    };
  }

  /**
   * Verifica si el servicio está listo para ejecutar código
   */
  isReady(): boolean {
    return this.runner.isReady();
  }
}