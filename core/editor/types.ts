// Core types for the Editor Engine
export interface Position {
  line: number;
  column: number;
}

export interface Selection {
  from: Position;
  to: Position;
  text?: string;
}

export interface Buffer {
  id: string;
  content: string;
  language: 'javascript' | 'typescript' | 'json' | 'css' | 'html';
  modified: boolean;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
  updateLanguageFromContent?: () => void;
}

export interface CompletionItem {
  label: string;
  detail?: string;
  documentation?: string;
  insertText: string;
  kind: CompletionKind;
}

export enum CompletionKind {
  Function = 'function',
  Variable = 'variable',
  Class = 'class',
  Interface = 'interface',
  Method = 'method',
  Property = 'property',
  Keyword = 'keyword',
  Snippet = 'snippet'
}

export type LanguageType = 'javascript' | 'typescript' | 'json' | 'css' | 'html';

export interface EditorConfig {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  autoComplete: boolean;
  linting: boolean;
  autoDetectLanguage?: boolean;
}