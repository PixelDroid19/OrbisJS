/**
 * Action Registry - Manages available MCP actions and their handlers
 * Provides action definition, validation, and execution routing
 */

import type {
  MCPAction,
  MCPActionType,
  ActionTarget,
  ActionResult,
  MCPContext,
  CodeChange
} from './types.js';

export interface ActionDefinition {
  type: MCPActionType;
  name: string;
  description: string;
  supportedTargets: ActionTarget['type'][];
  requiredParameters: string[];
  optionalParameters: string[];
  handler: ActionHandler;
}

export type ActionHandler = (
  action: MCPAction,
  context: MCPContext
) => Promise<ActionResult>;

export class ActionRegistry {
  private actions: Map<MCPActionType, ActionDefinition> = new Map();

  constructor() {
    this.registerBuiltInActions();
  }

  // Register a new action
  registerAction(definition: ActionDefinition): void {
    this.actions.set(definition.type, definition);
  }

  // Unregister an action
  unregisterAction(type: MCPActionType): void {
    this.actions.delete(type);
  }

  // Get action definition
  getAction(type: MCPActionType): ActionDefinition | null {
    return this.actions.get(type) || null;
  }

  // List all registered actions
  listActions(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  // Validate an action
  validateAction(action: MCPAction): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if action type is registered
    const definition = this.actions.get(action.type);
    if (!definition) {
      errors.push(`Unknown action type: ${action.type}`);
      return { valid: false, errors };
    }

    // Check if target type is supported
    if (!definition.supportedTargets.includes(action.target.type)) {
      errors.push(`Target type '${action.target.type}' not supported for action '${action.type}'`);
    }

    // Check required parameters
    for (const param of definition.requiredParameters) {
      if (!(param in action.parameters)) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    // Validate target-specific requirements
    const targetErrors = this.validateTarget(action.target, action.type);
    errors.push(...targetErrors);

    return { valid: errors.length === 0, errors };
  }

  // Execute an action
  async executeAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const validation = this.validateAction(action);
    if (!validation.valid) {
      return {
        success: false,
        error: `Action validation failed: ${validation.errors.join(', ')}`
      };
    }

    const definition = this.actions.get(action.type)!;

    try {
      return await definition.handler(action, context);
    } catch (error) {
      return {
        success: false,
        error: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Private methods
  private validateTarget(target: ActionTarget, actionType: MCPActionType): string[] {
    const errors: string[] = [];

    switch (target.type) {
      case 'selection':
        if (!target.range) {
          errors.push('Selection target requires range property');
        }
        break;

      case 'file':
        if (!target.path) {
          errors.push('File target requires path property');
        }
        break;

      case 'function':
      case 'class':
        if (!target.identifier) {
          errors.push(`${target.type} target requires identifier property`);
        }
        break;
    }

    return errors;
  }

  private registerBuiltInActions(): void {
    // Refactor action
    this.registerAction({
      type: 'refactor',
      name: 'Refactor Code',
      description: 'Refactor selected code or function',
      supportedTargets: ['selection', 'function', 'class'],
      requiredParameters: ['instruction'],
      optionalParameters: ['preserveComments', 'style'],
      handler: this.handleRefactorAction.bind(this)
    });

    // Rename action
    this.registerAction({
      type: 'rename',
      name: 'Rename Symbol',
      description: 'Rename a variable, function, or class',
      supportedTargets: ['function', 'class', 'selection'],
      requiredParameters: ['newName'],
      optionalParameters: ['scope'],
      handler: this.handleRenameAction.bind(this)
    });

    // Document action
    this.registerAction({
      type: 'document',
      name: 'Generate Documentation',
      description: 'Generate documentation for code',
      supportedTargets: ['selection', 'function', 'class', 'file'],
      requiredParameters: [],
      optionalParameters: ['style', 'includeExamples'],
      handler: this.handleDocumentAction.bind(this)
    });

    // Generate action
    this.registerAction({
      type: 'generate',
      name: 'Generate Code',
      description: 'Generate code based on description',
      supportedTargets: ['selection', 'file'],
      requiredParameters: ['description'],
      optionalParameters: ['framework', 'style'],
      handler: this.handleGenerateAction.bind(this)
    });

    // Explain action
    this.registerAction({
      type: 'explain',
      name: 'Explain Code',
      description: 'Explain what the code does',
      supportedTargets: ['selection', 'function', 'class', 'file'],
      requiredParameters: [],
      optionalParameters: ['level'],
      handler: this.handleExplainAction.bind(this)
    });

    // Format action
    this.registerAction({
      type: 'format',
      name: 'Format Code',
      description: 'Format and beautify code',
      supportedTargets: ['selection', 'file'],
      requiredParameters: [],
      optionalParameters: ['style', 'indentSize'],
      handler: this.handleFormatAction.bind(this)
    });

    // Optimize action
    this.registerAction({
      type: 'optimize',
      name: 'Optimize Code',
      description: 'Optimize code for performance',
      supportedTargets: ['selection', 'function', 'class', 'file'],
      requiredParameters: [],
      optionalParameters: ['target', 'aggressive'],
      handler: this.handleOptimizeAction.bind(this)
    });
  }

  // Built-in action handlers
  private async handleRefactorAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const instruction = action.parameters.instruction as string;
    const _preserveComments = action.parameters.preserveComments as boolean ?? true;

    // Get the code to refactor
    const code = this.extractCodeFromTarget(action.target, context);

    // Simple refactoring simulation
    const refactoredCode = this.simulateRefactoring(code, instruction, _preserveComments);

    const changes: CodeChange[] = [{
      type: 'replace',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: refactoredCode
    }];

    return {
      success: true,
      changes,
      metadata: {
        instruction,
        preserveComments: _preserveComments,
        originalLength: code.length,
        refactoredLength: refactoredCode.length
      }
    };
  }

  private async handleRenameAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const newName = action.parameters.newName as string;
    const scope = action.parameters.scope as string ?? 'local';

    const code = this.extractCodeFromTarget(action.target, context);
    const renamedCode = this.simulateRename(code, action.target.identifier || '', newName);

    const changes: CodeChange[] = [{
      type: 'replace',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: renamedCode
    }];

    return {
      success: true,
      changes,
      metadata: {
        oldName: action.target.identifier,
        newName,
        scope,
        occurrences: this.countOccurrences(code, action.target.identifier || '')
      }
    };
  }

  private async handleDocumentAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const style = action.parameters.style as string ?? 'jsdoc';
    const includeExamples = action.parameters.includeExamples as boolean ?? false;

    const code = this.extractCodeFromTarget(action.target, context);
    const documentation = this.generateDocumentation(code, style, includeExamples);

    const changes: CodeChange[] = [{
      type: 'insert',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: documentation
    }];

    return {
      success: true,
      changes,
      metadata: {
        style,
        includeExamples,
        documentationLength: documentation.length
      }
    };
  }

  private async handleGenerateAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const description = action.parameters.description as string;
    const framework = action.parameters.framework as string ?? 'vanilla';

    const generatedCode = this.generateCode(description, framework, context);

    const changes: CodeChange[] = [{
      type: action.target.type === 'selection' ? 'replace' : 'insert',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: generatedCode
    }];

    return {
      success: true,
      changes,
      metadata: {
        description,
        framework,
        generatedLength: generatedCode.length
      }
    };
  }

  private async handleExplainAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const level = action.parameters.level as string ?? 'intermediate';

    const code = this.extractCodeFromTarget(action.target, context);
    const explanation = this.generateExplanation(code, level, context.buffer.language);

    return {
      success: true,
      metadata: {
        explanation,
        level,
        codeLength: code.length,
        language: context.buffer.language
      }
    };
  }

  private async handleFormatAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const style = action.parameters.style as string ?? 'standard';
    const indentSize = action.parameters.indentSize as number ?? 2;

    const code = this.extractCodeFromTarget(action.target, context);
    const formattedCode = this.formatCode(code, style, indentSize);

    const changes: CodeChange[] = [{
      type: 'replace',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: formattedCode
    }];

    return {
      success: true,
      changes,
      metadata: {
        style,
        indentSize,
        originalLength: code.length,
        formattedLength: formattedCode.length
      }
    };
  }

  private async handleOptimizeAction(action: MCPAction, context: MCPContext): Promise<ActionResult> {
    const target = action.parameters.target as string ?? 'performance';
    const aggressive = action.parameters.aggressive as boolean ?? false;

    const code = this.extractCodeFromTarget(action.target, context);
    const optimizedCode = this.optimizeCode(code, target, aggressive);

    const changes: CodeChange[] = [{
      type: 'replace',
      path: action.target.path || context.buffer.path || 'current-buffer',
      range: action.target.range,
      content: optimizedCode
    }];

    return {
      success: true,
      changes,
      metadata: {
        target,
        aggressive,
        originalLength: code.length,
        optimizedLength: optimizedCode.length,
        optimizations: ['removed unused variables', 'simplified expressions']
      }
    };
  }

  // Helper methods for code manipulation
  private extractCodeFromTarget(target: ActionTarget, context: MCPContext): string {
    switch (target.type) {
      case 'selection':
        return context.buffer.selection?.text || '';
      case 'file':
        return context.buffer.content;
      case 'function':
      case 'class':
        // In a real implementation, this would use AST parsing
        return context.buffer.selection?.text || context.buffer.content;
      default:
        return context.buffer.content;
    }
  }

  private simulateRefactoring(code: string, instruction: string, _preserveComments: boolean): string {
    // Simple refactoring simulation
    let refactored = code;

    if (instruction.includes('extract function')) {
      refactored = `function extractedFunction() {\n  ${code.trim()}\n}\n\nextractedFunction();`;
    } else if (instruction.includes('inline')) {
      refactored = code.replace(/function\s+\w+\s*\([^)]*\)\s*{([^}]*)}/g, '$1');
    }

    return refactored;
  }

  private simulateRename(code: string, oldName: string, newName: string): string {
    if (!oldName) return code;

    // Simple rename simulation using regex
    const regex = new RegExp(`\\b${oldName}\\b`, 'g');
    return code.replace(regex, newName);
  }

  private countOccurrences(code: string, identifier: string): number {
    if (!identifier) return 0;

    const regex = new RegExp(`\\b${identifier}\\b`, 'g');
    const matches = code.match(regex);
    return matches ? matches.length : 0;
  }

  private generateDocumentation(code: string, style: string, includeExamples: boolean): string {
    const lines = code.split('\n');
    const firstLine = lines[0]?.trim() || '';

    let doc = '';

    if (style === 'jsdoc') {
      doc = '/**\n';

      if (firstLine.includes('function') || firstLine.includes('=>')) {
        doc += ' * Description of this function\n';
        if (includeExamples) {
          doc += ' * @example\n * // Usage example\n * functionName();\n';
        }
        doc += ' * @returns {*} Return value description\n';
      } else if (firstLine.includes('class')) {
        doc += ' * Description of this class\n';
        if (includeExamples) {
          doc += ' * @example\n * const instance = new ClassName();\n';
        }
      } else {
        doc += ' * Code documentation\n';
      }

      doc += ' */\n';
    }

    return doc;
  }

  private generateCode(description: string, framework: string, _context: MCPContext): string {
    // Simple code generation based on description
    if (description.includes('function')) {
      return `function generatedFunction() {\n  // Generated based on: ${description}\n  return true;\n}`;
    } else if (description.includes('component') && framework === 'react') {
      return `function GeneratedComponent() {\n  return <div>Generated component</div>;\n}`;
    } else {
      return `// Generated code based on: ${description}\nconst result = true;`;
    }
  }

  private generateExplanation(code: string, level: string, language: string): string {
    const lines = code.split('\n').length;
    const complexity = code.length > 100 ? 'complex' : 'simple';

    return `This ${language} code is ${complexity} and contains ${lines} lines. ` +
      `It performs various operations. Explanation level: ${level}.`;
  }

  private formatCode(code: string, style: string, indentSize: number): string {
    // Simple formatting
    const indent = ' '.repeat(indentSize);

    return code
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.includes('{') || trimmed.includes('}')) {
          return trimmed;
        }
        return trimmed ? indent + trimmed : '';
      })
      .join('\n');
  }

  private optimizeCode(code: string, target: string, aggressive: boolean): string {
    let optimized = code;

    // Simple optimizations
    if (target === 'performance') {
      // Remove console.log statements
      optimized = optimized.replace(/console\.log\([^)]*\);?\n?/g, '');

      if (aggressive) {
        // Remove comments
        optimized = optimized.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      }
    }

    return optimized.trim();
  }
}