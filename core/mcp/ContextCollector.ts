/**
 * Context Collector - Gathers context from various application components
 * Provides real-time context collection from editor, project, and execution state
 */

import type {
  MCPContext,
  BufferContext,
  ProjectContext,
  ExecutionContext,
  UserContext,
  FileTree,
  FileNode,
  ProjectConfig,
  PackageInfo,
  ProcessInfo,
  UserPreferences,
  UserAction
} from './types.js';

import type { EditorEngine, Buffer } from '../editor/types.js';
import type { WebContainerRunner, ExecutionResult } from '../runner/types.js';

export class ContextCollector {
  private editorEngine?: EditorEngine;
  private runnerEngine?: WebContainerRunner;
  private userActionHistory: UserAction[] = [];
  private maxHistorySize = 100;

  constructor() {
    // Constructor is lightweight - actual initialization happens in initialize()
  }

  async initialize(): Promise<void> {
    // In a real implementation, these would be injected or retrieved from a service locator
    // For now, we'll set up the structure to be connected later
    this.setupEventListeners();
  }

  async destroy(): Promise<void> {
    this.removeEventListeners();
    this.userActionHistory = [];
  }

  // Set engine references (to be called by the main application)
  setEditorEngine(editorEngine: EditorEngine): void {
    this.editorEngine = editorEngine;
  }

  setRunnerEngine(runnerEngine: WebContainerRunner): void {
    this.runnerEngine = runnerEngine;
  }

  // Main context collection method
  async collectContext(): Promise<MCPContext> {
    const contextId = this.generateContextId();
    const timestamp = new Date();

    const [bufferContext, projectContext, executionContext, userContext] = await Promise.all([
      this.collectBufferContext(),
      this.collectProjectContext(),
      this.collectExecutionContext(),
      this.collectUserContext()
    ]);

    return {
      id: contextId,
      timestamp,
      buffer: bufferContext,
      project: projectContext,
      execution: executionContext,
      user: userContext
    };
  }

  // Buffer context collection
  async collectBufferContext(): Promise<BufferContext> {
    if (!this.editorEngine) {
      return this.getEmptyBufferContext();
    }

    try {
      const content = this.editorEngine.getContent();
      const language = this.editorEngine.getLanguage();
      const selection = this.editorEngine.getSelection();
      
      // Get cursor position from selection
      const cursor = selection ? selection.from : { line: 0, column: 0 };

      // Get current buffer information
      const currentBuffer = this.getCurrentBuffer();

      return {
        content,
        language,
        selection,
        cursor,
        path: currentBuffer?.path,
        modified: currentBuffer?.modified || false
      };
    } catch (error) {
      console.error('Error collecting buffer context:', error);
      return this.getEmptyBufferContext();
    }
  }

  // Project context collection
  async collectProjectContext(): Promise<ProjectContext> {
    try {
      const structure = await this.collectFileTree();
      const config = await this.collectProjectConfig();
      const dependencies = await this.collectDependencies();

      return {
        structure,
        config,
        dependencies,
        rootPath: this.getProjectRootPath()
      };
    } catch (error) {
      console.error('Error collecting project context:', error);
      return this.getEmptyProjectContext();
    }
  }

  // Execution context collection
  async collectExecutionContext(): Promise<ExecutionContext> {
    try {
      const history = await this.collectExecutionHistory();
      const currentProcess = await this.collectCurrentProcessInfo();
      const environment = await this.collectEnvironmentVariables();

      return {
        history,
        currentProcess,
        environment
      };
    } catch (error) {
      console.error('Error collecting execution context:', error);
      return this.getEmptyExecutionContext();
    }
  }

  // User context collection
  async collectUserContext(): Promise<UserContext> {
    try {
      const preferences = await this.collectUserPreferences();
      const recentActions = this.getRecentUserActions();
      const activeFeatures = this.getActiveFeatures();

      return {
        preferences,
        recentActions,
        activeFeatures
      };
    } catch (error) {
      console.error('Error collecting user context:', error);
      return this.getEmptyUserContext();
    }
  }

  // Private helper methods
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentBuffer(): Buffer | null {
    if (!this.editorEngine || !('listBuffers' in this.editorEngine)) {
      return null;
    }

    try {
      const buffers = (this.editorEngine as unknown).listBuffers();
      return buffers.find((buffer: Buffer) => buffer.id === 'current') || buffers[0] || null;
    } catch (error) {
      console.error('Error getting current buffer:', error);
      return null;
    }
  }

  private async collectFileTree(): Promise<FileTree> {
    if (!this.runnerEngine) {
      return {};
    }

    try {
      // Use the runner's file system to get project structure
      const files = await this.runnerEngine.listFiles('/');
      const tree: FileTree = {};

      for (const file of files) {
        const node: FileNode = {
          type: file.endsWith('/') ? 'directory' : 'file',
          modified: new Date()
        };

        if (node.type === 'file') {
          try {
            node.content = await this.runnerEngine.readFile(file);
            node.size = node.content?.length || 0;
          } catch (error) {
            // File might not be readable, skip content
          }
        }

        tree[file] = node;
      }

      return tree;
    } catch (error) {
      console.error('Error collecting file tree:', error);
      return {};
    }
  }

  private async collectProjectConfig(): Promise<ProjectConfig> {
    const config: ProjectConfig = {};

    try {
      // Try to read package.json
      if (this.runnerEngine) {
        try {
          const packageJsonContent = await this.runnerEngine.readFile('/package.json');
          config.packageJson = JSON.parse(packageJsonContent);
          config.name = config.packageJson?.name;
        } catch (error) {
          // package.json might not exist
        }

        // Try to read tsconfig.json
        try {
          const tsconfigContent = await this.runnerEngine.readFile('/tsconfig.json');
          config.tsconfig = JSON.parse(tsconfigContent);
          config.type = 'typescript';
        } catch (error) {
          // tsconfig.json might not exist, assume JavaScript
          config.type = config.type || 'javascript';
        }
      }
    } catch (error) {
      console.error('Error collecting project config:', error);
    }

    return config;
  }

  private async collectDependencies(): Promise<PackageInfo[]> {
    const dependencies: PackageInfo[] = [];

    try {
      if (this.runnerEngine) {
        const packageJsonContent = await this.runnerEngine.readFile('/package.json');
        const packageJson = JSON.parse(packageJsonContent);

        // Add regular dependencies
        if (packageJson.dependencies) {
          for (const [name, version] of Object.entries(packageJson.dependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'dependency'
            });
          }
        }

        // Add dev dependencies
        if (packageJson.devDependencies) {
          for (const [name, version] of Object.entries(packageJson.devDependencies)) {
            dependencies.push({
              name,
              version: version as string,
              type: 'devDependency'
            });
          }
        }
      }
    } catch (error) {
      // package.json might not exist or be malformed
    }

    return dependencies;
  }

  private async collectExecutionHistory(): Promise<ExecutionResult[]> {
    // In a real implementation, this would come from a history service
    // For now, return empty array
    return [];
  }

  private async collectCurrentProcessInfo(): Promise<ProcessInfo | undefined> {
    if (!this.runnerEngine) {
      return undefined;
    }

    try {
      const status = this.runnerEngine.getProcessStatus();
      return {
        status,
        startTime: new Date() // This would be tracked properly in a real implementation
      };
    } catch (error) {
      return undefined;
    }
  }

  private async collectEnvironmentVariables(): Promise<Record<string, string>> {
    // Return basic environment info
    return {
      NODE_ENV: 'development',
      PLATFORM: typeof window !== 'undefined' ? 'browser' : 'node'
    };
  }

  private async collectUserPreferences(): Promise<UserPreferences> {
    // In a real implementation, this would come from a settings service
    return {
      theme: 'dark',
      fontSize: 14,
      tabSize: 2,
      autoSave: true
    };
  }

  private getRecentUserActions(): UserAction[] {
    return this.userActionHistory.slice(-10); // Return last 10 actions
  }

  private getActiveFeatures(): string[] {
    // Return list of currently active features
    return ['editor', 'runner', 'ai-engine'];
  }

  private getProjectRootPath(): string | undefined {
    // In a real implementation, this would be tracked by the application
    return '/';
  }

  // Event listeners for tracking user actions
  private setupEventListeners(): void {
    // In a real implementation, these would listen to actual events from the application
    // For now, we'll set up the structure
  }

  private removeEventListeners(): void {
    // Clean up event listeners
  }

  // Track user actions
  trackUserAction(action: UserAction): void {
    this.userActionHistory.push(action);
    
    // Keep history size manageable
    if (this.userActionHistory.length > this.maxHistorySize) {
      this.userActionHistory = this.userActionHistory.slice(-this.maxHistorySize);
    }
  }

  // Empty context fallbacks
  private getEmptyBufferContext(): BufferContext {
    return {
      content: '',
      language: 'javascript',
      cursor: { line: 0, column: 0 },
      modified: false
    };
  }

  private getEmptyProjectContext(): ProjectContext {
    return {
      structure: {},
      config: {},
      dependencies: []
    };
  }

  private getEmptyExecutionContext(): ExecutionContext {
    return {
      history: [],
      environment: {}
    };
  }

  private getEmptyUserContext(): UserContext {
    return {
      preferences: {
        theme: 'dark',
        fontSize: 14,
        tabSize: 2,
        autoSave: true
      },
      recentActions: [],
      activeFeatures: []
    };
  }
}