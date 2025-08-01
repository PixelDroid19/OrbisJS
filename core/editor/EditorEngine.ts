import { EditorView } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';

import { 
  Position, 
  Selection, 
  Buffer, 
  CompletionItem, 
  LanguageType, 
  EditorConfig 
} from './types';
import { LanguageDetectionService } from './LanguageDetectionService';
import { BufferManager } from './BufferManager';
import { CodeMirrorExtensions } from './CodeMirrorExtensions';
import { CompletionService } from './CompletionService';
import { DEFAULT_CONFIG } from './constants';
import type { PackageManager } from '../runner/PackageManager.js';

export interface EditorEngine {
  // Content management
  setContent(content: string): void;
  getContent(): string;
  getSelection(): Selection | null;
  setSelection(selection: Selection): void;
  
  // Language support
  setLanguage(language: LanguageType): void;
  getLanguage(): LanguageType;
  updateLanguageFromContent(): void;
  
  // Event handling
  onChange(callback: (content: string) => void): void;
  onSelectionChange(callback: (selection: Selection | null) => void): void;
  onCursorMove(callback: (position: Position) => void): void;
  
  // AI integration placeholders
  requestCompletion(position: Position): Promise<CompletionItem[]>;
  requestRefactor(selection: Selection, instruction: string): Promise<string>;
  
  // Buffer management
  createBuffer(id: string, language?: LanguageType): Buffer;
  switchBuffer(id: string): void;
  closeBuffer(id: string): void;
  listBuffers(): Buffer[];
  getCurrentBuffer(): Buffer | null;
  
  // Editor lifecycle
  mount(container: HTMLElement): void;
  unmount(): void;
  focus(): void;
  
  // Configuration
  updateConfig(config: Partial<EditorConfig>): void;
  setAutoDetectLanguage(enabled: boolean): void;
  getAutoDetectLanguage(): boolean;
  
  // Package management integration
  setPackageManager(packageManager: PackageManager): void;
  refreshPackageCompletions(): void;
}

export class CodeMirrorEditorEngine implements EditorEngine {
  private view: EditorView | null = null;
  private bufferManager: BufferManager = new BufferManager();
  private config: EditorConfig;
  private changeCallbacks: ((content: string) => void)[] = [];
  private selectionCallbacks: ((selection: Selection | null) => void)[] = [];
  private cursorCallbacks: ((position: Position) => void)[] = [];
  private autoDetectLanguage: boolean = true;

  private languageDetectionService: LanguageDetectionService;
  private extensions: CodeMirrorExtensions;

  constructor(config: Partial<EditorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.autoDetectLanguage = this.config.autoDetectLanguage ?? true;
    this.languageDetectionService = new LanguageDetectionService();
    this.extensions = new CodeMirrorExtensions();
  }

  private updateCurrentBufferContent(content: string): void {
    const currentBuffer = this.bufferManager.getCurrentBuffer();
    if (currentBuffer) {
      this.bufferManager.updateBufferContent(currentBuffer.id, content);
    }
  }

  private createExtensions(language: LanguageType): Extension[] {
    const baseExtensions = this.extensions.createBaseExtensions({
      theme: this.config.theme,
      tabSize: this.config.tabSize,
      linting: this.config.linting,
      language: language,
      autoComplete: this.config.autoComplete
    });

    // Add update listener
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        this.updateCurrentBufferContent(content);
        this.changeCallbacks.forEach(callback => callback(content));
      }
      
      if (update.selectionSet) {
        const selection = this.getSelectionFromState(update.state);
        this.selectionCallbacks.forEach(callback => callback(selection));
        
        if (selection) {
          const position = selection.from;
          this.cursorCallbacks.forEach(callback => callback(position));
        }
      }
    });

    return [...baseExtensions, updateListener];
  }

  private getSelectionFromState(state: EditorState): Selection | null {
    const selection = state.selection.main;
    if (selection.empty) return null;

    const from = state.doc.lineAt(selection.from);
    const to = state.doc.lineAt(selection.to);

    return {
      from: {
        line: from.number - 1, // Convert to 0-based
        column: selection.from - from.from
      },
      to: {
        line: to.number - 1, // Convert to 0-based
        column: selection.to - to.from
      },
      text: state.doc.sliceString(selection.from, selection.to)
    };
  }

  // Public API Implementation
  setContent(content: string): void {
    if (this.view) {
      const currentContent = this.view.state.doc.toString();
      
      // Only update if content actually changed
      if (currentContent === content) return;
      
      // Get current cursor position
      const cursorPos = this.view.state.selection.main.from;
      
      // Try to maintain cursor position
      let newPos = Math.min(cursorPos, content.length);
      
      // If the cursor was at the end, keep it at the end
      if (cursorPos >= currentContent.length) {
        newPos = content.length;
      }
      
      this.view.dispatch({
        changes: {
          from: 0,
          to: this.view.state.doc.length,
          insert: content
        },
        selection: { anchor: newPos }
      });
      
      // Auto-detect language if enabled
      if (this.autoDetectLanguage) {
        this.updateLanguageFromContent();
      }
    }
  }

  setAutoDetectLanguage(enabled: boolean): void {
    this.autoDetectLanguage = enabled;
  }

  getAutoDetectLanguage(): boolean {
    return this.autoDetectLanguage;
  }

  getContent(): string {
    return this.view?.state.doc.toString() || '';
  }

  getSelection(): Selection | null {
    if (!this.view) return null;
    return this.getSelectionFromState(this.view.state);
  }

  setSelection(selection: Selection): void {
    if (!this.view) return;

    const doc = this.view.state.doc;
    const fromLine = doc.line(selection.from.line + 1); // Convert to 1-based
    const toLine = doc.line(selection.to.line + 1);
    
    const from = fromLine.from + selection.from.column;
    const to = toLine.from + selection.to.column;

    this.view.dispatch({
      selection: { anchor: from, head: to }
    });
  }

  setLanguage(language: LanguageType): void {
    const currentBuffer = this.bufferManager.getCurrentBuffer();
    if (currentBuffer) {
      this.bufferManager.updateBufferLanguage(currentBuffer.id, language);
      
      // Use compartments to update language without losing state
      if (this.view) {
        const compartments = this.extensions.getCompartments();
        this.view.dispatch({
          effects: [
            compartments.language.reconfigure(this.extensions.getLanguageExtension(language)),
            compartments.completion.reconfigure(this.extensions.getCompletionExtensions(language, this.config.autoComplete))
          ]
        });
      }
    }
  }

  getLanguage(): LanguageType {
    const buffer = this.getCurrentBuffer();
    return buffer?.language || 'javascript';
  }

  onChange(callback: (content: string) => void): void {
    this.changeCallbacks.push(callback);
  }

  onSelectionChange(callback: (selection: Selection | null) => void): void {
    this.selectionCallbacks.push(callback);
  }

  onCursorMove(callback: (position: Position) => void): void {
    this.cursorCallbacks.push(callback);
  }

  // Language auto-detection
  updateLanguageFromContent(): void {
    const content = this.getContent();
    const buffer = this.getCurrentBuffer();
    if (buffer) {
      const detectedLanguage = this.detectLanguage(content, buffer.path);
      if (detectedLanguage !== buffer.language) {
        this.setLanguage(detectedLanguage);
      }
    }
  }

  // AI integration placeholders - to be implemented with AI Engine
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async requestCompletion(_position: Position): Promise<CompletionItem[]> {
    // TODO: Integrate with AI Engine
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async requestRefactor(selection: Selection, _instruction: string): Promise<string> {
    // TODO: Integrate with AI Engine
    return selection.text || '';
  }

  // Language detection
  private detectLanguage(content: string, filename?: string): LanguageType {
    return this.languageDetectionService.detectLanguage(content, filename);
  }

  // Buffer management
  createBuffer(id: string, language?: LanguageType): Buffer {
    return this.bufferManager.createBuffer(id, language);
  }

  switchBuffer(id: string): void {
    this.bufferManager.switchBuffer(id);
  }

  closeBuffer(id: string): void {
    this.bufferManager.closeBuffer(id);
  }

  listBuffers(): Buffer[] {
    return this.bufferManager.listBuffers();
  }

  getCurrentBuffer(): Buffer | null {
    return this.bufferManager.getCurrentBuffer();
  }

  // Editor lifecycle
  mount(container: HTMLElement): void {
    if (this.view) {
      this.view.destroy();
    }

    const buffer = this.getCurrentBuffer();
    const language = buffer?.language || 'javascript';
    const content = buffer?.content || '';

    const state = EditorState.create({
      doc: content,
      extensions: this.createExtensions(language)
    });

    this.view = new EditorView({
      state,
      parent: container
    });
  }

  unmount(): void {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }

  focus(): void {
    this.view?.focus();
  }

  preserveFocus<T>(operation: () => T): T {
    const hadFocus = this.view?.hasFocus || false;
    const result = operation();
    if (hadFocus) {
      this.view?.focus();
    }
    return result;
  }

  updateConfig(config: Partial<EditorConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    if (this.view) {
      const effects = [];
      const compartments = this.extensions.getCompartments();
      
      // Update theme if changed
      if (oldConfig.theme !== this.config.theme) {
        effects.push(
          compartments.theme.reconfigure(
            this.config.theme === 'dark' ? oneDark : []
          )
        );
      }
      
      // Update completion if autoComplete setting changed
      if (oldConfig.autoComplete !== this.config.autoComplete) {
        const buffer = this.getCurrentBuffer();
        const language = buffer?.language || 'javascript';
        effects.push(
          compartments.completion.reconfigure(this.extensions.getCompletionExtensions(language, this.config.autoComplete))
        );
      }
      
      if (effects.length > 0) {
        this.view.dispatch({ effects });
      }
    }
  }

  // Package management integration
  setPackageManager(packageManager: PackageManager): void {
    CompletionService.setPackageManager(packageManager);
    
    // Reconfigure completion extensions to include package completions
    if (this.view) {
      const buffer = this.getCurrentBuffer();
      const language = buffer?.language || 'javascript';
      const compartments = this.extensions.getCompartments();
      
      this.view.dispatch({
        effects: [
          compartments.completion.reconfigure(
            this.extensions.getCompletionExtensions(language, this.config.autoComplete)
          )
        ]
      });
    }
  }

  refreshPackageCompletions(): void {
    // Force refresh of completion extensions to pick up new packages
    if (this.view) {
      const buffer = this.getCurrentBuffer();
      const language = buffer?.language || 'javascript';
      const compartments = this.extensions.getCompartments();
      
      this.view.dispatch({
        effects: [
          compartments.completion.reconfigure(
            this.extensions.getCompletionExtensions(language, this.config.autoComplete)
          )
        ]
      });
    }
  }
}