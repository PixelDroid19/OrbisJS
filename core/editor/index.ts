// Core Editor Engine exports
export { CodeMirrorEditorEngine } from './EditorEngine';
export type { EditorEngine } from './EditorEngine';

// React Component exports
export { EditorComponent } from './EditorComponent';
export type { EditorComponentProps, EditorComponentRef } from './EditorComponent';

// Service exports
export { BufferManager } from './BufferManager';
export { LanguageDetectionService } from './LanguageDetectionService';
export { CompletionService } from './CompletionService';
export { CodeMirrorExtensions } from './CodeMirrorExtensions';

// Constants exports
export { DEFAULT_CONFIG, LANGUAGE_PATTERNS } from './constants';

// Type exports
export type {
  Position,
  Selection,
  Buffer,
  CompletionItem,
  LanguageType,
  EditorConfig
} from './types';

export { CompletionKind } from './types';