/**
 * Base MCP Provider - Abstract base class for MCP providers
 * Provides common functionality and structure for MCP provider implementations
 */

import type {
  MCPProvider,
  MCPProviderId,
  MCPCapability,
  MCPContext,
  MCPAction,
  ActionResult,
  ProcessedContext,
  CodeChange
} from './types.js';

export abstract class BaseMCPProvider implements MCPProvider {
  public readonly id: MCPProviderId;
  public readonly name: string;
  public readonly capabilities: MCPCapability[];

  constructor(id: MCPProviderId, name: string, capabilities: MCPCapability[]) {
    this.id = id;
    this.name = name;
    this.capabilities = capabilities;
  }

  // Abstract methods that must be implemented by concrete providers
  abstract processContext(context: MCPContext): Promise<ProcessedContext>;
  abstract executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult>;

  // Optional lifecycle methods
  async initialize(): Promise<void> {
    // Default implementation - can be overridden
  }

  async destroy(): Promise<void> {
    // Default implementation - can be overridden
  }

  // Helper methods for common operations
  protected createSuccessResult(changes?: CodeChange[], metadata?: Record<string, unknown>): ActionResult {
    return {
      success: true,
      changes,
      metadata
    };
  }

  protected createErrorResult(error: string, metadata?: Record<string, unknown>): ActionResult {
    return {
      success: false,
      error,
      metadata
    };
  }

  protected hasCapability(capability: MCPCapability): boolean {
    return this.capabilities.includes(capability);
  }

  protected validateAction(action: MCPAction): boolean {
    // Basic validation - can be extended by subclasses
    return !!(action.id && action.type && action.target);
  }

  protected extractRelevantContext(context: MCPContext, action: MCPAction): Partial<MCPContext> {
    // Extract only the context relevant to the action
    const relevant: Partial<MCPContext> = {
      id: context.id,
      timestamp: context.timestamp
    };

    // Include buffer context for most actions
    if (action.target.type === 'selection' || action.target.type === 'file') {
      relevant.buffer = context.buffer;
    }

    // Include project context for project-wide actions
    if (action.target.type === 'project') {
      relevant.project = context.project;
    }

    return relevant;
  }

  protected generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Default MCP Provider - A simple implementation for testing and fallback
 */
export class DefaultMCPProvider extends BaseMCPProvider {
  constructor() {
    super('default', 'Default MCP Provider', ['context_processing', 'action_execution']);
  }

  async processContext(context: MCPContext): Promise<ProcessedContext> {
    // Simple context processing
    const relevantFiles = Object.keys(context.project.structure).filter(path => 
      path.endsWith('.js') || path.endsWith('.ts')
    );

    return {
      summary: `Project with ${relevantFiles.length} code files. Current buffer: ${context.buffer.language}`,
      relevantFiles,
      suggestions: [
        'Consider adding type annotations',
        'Review code for potential optimizations',
        'Add error handling where appropriate'
      ],
      metadata: {
        bufferSize: context.buffer.content.length,
        projectFiles: Object.keys(context.project.structure).length
      }
    };
  }

  async executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    if (!this.validateAction(action)) {
      return this.createErrorResult('Invalid action format');
    }

    try {
      switch (action.type) {
        case 'explain':
          return await this.handleExplainAction(action, context);
        
        case 'document':
          return await this.handleDocumentAction(action, context);
        
        case 'format':
          return await this.handleFormatAction(action, context);
        
        default:
          return this.createErrorResult(`Unsupported action type: ${action.type}`);
      }
    } catch (error) {
      return this.createErrorResult(
        `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleExplainAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    // Simple explanation generation
    const content = context.buffer.selection?.text || context.buffer.content;
    
    return this.createSuccessResult([], {
      explanation: `This ${context.buffer.language} code performs various operations. ` +
                  `It contains ${content.split('\n').length} lines of code.`,
      codeLength: content.length,
      language: context.buffer.language
    });
  }

  private async handleDocumentAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    // Simple documentation generation
    const content = context.buffer.selection?.text || context.buffer.content;
    const documentation = this.generateDocumentation(content, context.buffer.language);
    
    const changes: CodeChange[] = [{
      type: 'insert',
      path: context.buffer.path || 'current-buffer',
      range: context.buffer.selection,
      content: documentation
    }];

    return this.createSuccessResult(changes, {
      documentationType: 'jsdoc',
      insertedLines: documentation.split('\n').length
    });
  }

  private async handleFormatAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    // Simple formatting
    const content = context.buffer.selection?.text || context.buffer.content;
    const formatted = this.formatCode(content, context.buffer.language);
    
    const changes: CodeChange[] = [{
      type: 'replace',
      path: context.buffer.path || 'current-buffer',
      range: context.buffer.selection,
      content: formatted
    }];

    return this.createSuccessResult(changes, {
      formattingApplied: true,
      originalLength: content.length,
      formattedLength: formatted.length
    });
  }

  private generateDocumentation(code: string, _language: string): string {
    // Very basic documentation generation
    const lines = code.split('\n');
    const firstLine = lines[0]?.trim() || '';
    
    if (_language === 'javascript' || _language === 'typescript') {
      if (firstLine.includes('function') || firstLine.includes('=>')) {
        return '/**\n * Description of this function\n * @returns {*} Return value description\n */\n';
      }
      if (firstLine.includes('class')) {
        return '/**\n * Description of this class\n */\n';
      }
    }
    
    return '/**\n * Code documentation\n */\n';
  }

  private formatCode(code: string, _language: string): string {
    // Very basic formatting - just normalize whitespace
    return code
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
}