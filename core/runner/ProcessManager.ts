/**
 * ProcessManager - Safe process execution within WebContainer
 */

import type { 
  WebContainerInstance, 
  WebContainerProcess, 
  ExecutionResult, 
  OutputEvent, 
  ProcessStatus, 
  RunnerConfig 
} from './types.js';

/**
 * Manager for process execution within WebContainer
 */
export class ProcessManager {
  private container: WebContainerInstance;
  private currentProcess: WebContainerProcess | null = null;
  private outputBuffer: OutputEvent[] = [];
  private config: RunnerConfig;

  constructor(container: WebContainerInstance, config: RunnerConfig = {}) {
    this.container = container;
    this.config = {
      timeout: 30000,
      maxOutputSize: 100000,
      workingDirectory: '/',
      enableStderr: true,
      ...config
    };
  }

  /**
   * Execute a command in WebContainer
   */
  public async execute(
    command: string, 
    args: string[] = [], 
    options: { cwd?: string; env?: Record<string, string> } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Kill any existing process
      await this.killCurrentProcess();

      // Clear output buffer
      this.outputBuffer = [];

      // Spawn new process
      const process = await this.container.spawn(command, args, {
        cwd: options.cwd || this.config.workingDirectory,
        env: { ...options.env }
      });

      this.currentProcess = process;

      // Set up output collection in parallel with process execution
      const outputPromise = this.collectOutput(process);
      
      // Wait for process completion with timeout
      const exitCode = await this.waitForCompletion(process);

      // Wait a bit more for any remaining output
      await Promise.race([
        outputPromise,
        new Promise(resolve => setTimeout(resolve, 1000)) // Max 1 second for output collection
      ]);

      const duration = Date.now() - startTime;
      const output = this.getFormattedOutput();

      return {
        success: exitCode === 0,
        output,
        duration,
        timestamp: new Date()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        output: this.getFormattedOutput(),
        error: error instanceof Error ? error.message : 'Unknown execution error',
        duration,
        timestamp: new Date()
      };
    }
  }

  /**
   * Install npm packages
   */
  public async installPackages(packages: string[] = []): Promise<ExecutionResult> {
    if (packages.length === 0) {
      return this.execute('npm', ['install']);
    }
    
    return this.execute('npm', ['install', ...packages]);
  }

  /**
   * Run npm script
   */
  public async runScript(script: string): Promise<ExecutionResult> {
    return this.execute('npm', ['run', script]);
  }

  /**
   * Run Node.js file
   */
  public async runNode(file: string): Promise<ExecutionResult> {
    return this.execute('node', [file]);
  }

  /**
   * Collect output from process
   */
  private async collectOutput(process: WebContainerProcess): Promise<void> {
    const promises: Promise<void>[] = [];

    // Collect combined output (stdout + stderr)
    if (process.output) {
      promises.push(this.readStream(process.output, 'stdout'));
    }

    // Wait for all streams to complete or timeout
    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Error collecting output:', error);
    }
  }

  /**
   * Read from a stream safely
   */
  private async readStream(stream: ReadableStream<string>, type: 'stdout' | 'stderr'): Promise<void> {
    const reader = stream.getReader();
    
    try {
      let consecutiveEmptyReads = 0;
      const maxEmptyReads = 10; // Prevent infinite loops
      
      while (consecutiveEmptyReads < maxEmptyReads) {
        try {
          const { done, value } = await Promise.race([
            reader.read(),
            new Promise<{ done: true; value: undefined }>((_, reject) => 
              setTimeout(() => reject(new Error('Stream read timeout')), 5000)
            )
          ]);
          
          if (done) {
            break;
          }
          
          if (!value) {
            consecutiveEmptyReads++;
            continue;
          }
          
          consecutiveEmptyReads = 0;
          
          // Handle string values from the stream
          let text: string;
          if (typeof value === 'string') {
            text = value;
          } else {
            // Fallback to string conversion for non-string values
            text = String(value || '');
          }
          
          if (text.trim()) {
            this.addOutput(type, text);
          }
          
        } catch (readError) {
          if (readError instanceof Error && readError.message.includes('timeout')) {
            console.warn(`Stream read timeout for ${type}`);
            break;
          }
          throw readError;
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (error) {
        console.warn('Error releasing stream reader:', error);
      }
    }
  }

  /**
   * Add output to buffer
   */
  private addOutput(type: 'stdout' | 'stderr', content: string): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        this.outputBuffer.push({
          type,
          content: line,
          timestamp: new Date()
        });

        // Limit buffer size
        const maxSize = this.config.maxOutputSize || 1000;
        if (this.outputBuffer.length > maxSize) {
          this.outputBuffer.shift();
        }
      }
    }
  }

  /**
   * Wait for process completion with timeout
   */
  private async waitForCompletion(process: WebContainerProcess): Promise<number> {
    const timeoutMs = this.config.timeout || 30000;
    
    try {
      const exitCode = await Promise.race([
        process.exit,
        new Promise<number>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Process timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        })
      ]);
      
      return exitCode;
    } catch (error) {
      // Kill the process if it times out
      await this.killCurrentProcess();
      
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }
      
      // For other errors, return non-zero exit code
      return 1;
    }
  }

  /**
   * Get formatted output
   */
  private getFormattedOutput(): string {
    return this.outputBuffer
      .map(event => event.content)
      .join('\n');
  }

  /**
   * Get current process status
   */
  public getProcessStatus(): ProcessStatus {
    if (!this.currentProcess) {
      return 'idle';
    }

    // This is a simplified status check
    // In a real implementation, you might need more sophisticated tracking
    return 'running';
  }

  /**
   * Kill current process
   */
  private async killCurrentProcess(): Promise<void> {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch (error) {
        console.warn('Error killing process:', error);
      }
      this.currentProcess = null;
    }
  }

  /**
   * Get live output stream
   */
  public getOutputEvents(): OutputEvent[] {
    return [...this.outputBuffer];
  }

  /**
   * Clear output buffer
   */
  public clearOutput(): void {
    this.outputBuffer = [];
  }

  /**
   * Set up development server
   */
  public async setupDevServer(): Promise<void> {
    this.container.on('server-ready', (_, url) => {
      console.log(`Development server ready at: ${url}`);
    });
  }
}