export const LANGUAGE_PATTERNS = {
  javascript: {
    extensions: ['.js', '.mjs', '.jsx'],
    patterns: [
      /\b(function|const|let|var|import|export|class|async|await)\s+/,
      /\bconsole\.(log|warn|error|info)\(/,
      /=>\s*[{"']/, 
      /new\s+(Promise|Array|Object|Date)/
    ]
  },
  typescript: {
    extensions: ['.ts', '.tsx'],
    patterns: [
      /:\s*(string|number|boolean|any|void|never|unknown)/,
      /interface\s+\w+/,
      /type\s+\w+\s*=/,
      /as\s+\w+/,
      /\w+\?\s*:/
    ]
  },
  json: {
    extensions: ['.json'],
    patterns: [
      /^\s*{/, 
      /^\s*\[/, 
      /"\w+"\s*:/
    ]
  },
  css: {
    extensions: ['.css'],
    patterns: [
      /[.#]?\w+\s*{/, 
      /@media\s+/,
      /@import\s+["']/, 
      /\w+:\s*[^;]+;/
    ]
  },
  html: {
    extensions: ['.html', '.htm'],
    patterns: [
      /<!DOCTYPE\s+html>/i,
      /<html\s*/i,
      /<\w+\s+\w+=["'].*?["'].*?>/, 
      /<\w+>.*<\/\w+>/s 
    ]
  }
};

export const DEFAULT_CONFIG = {
  theme: 'light' as const,
  fontSize: 14,
  tabSize: 2,
  lineNumbers: true,
  wordWrap: false,
  autoComplete: true,
  linting: true,
  autoDetectLanguage: true
};