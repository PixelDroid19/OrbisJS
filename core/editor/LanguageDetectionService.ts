import { LanguageType } from './types';
import { LANGUAGE_PATTERNS } from './constants';

export class LanguageDetectionService {
  detectLanguage(content: string, filename?: string): LanguageType {
    // First try to detect from filename
    if (filename) {
      const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
        if (config.extensions.includes(extension)) {
          return lang as LanguageType;
        }
      }
    }

    // Then try to detect from content patterns
    const trimmedContent = content.trim();
    if (!trimmedContent) return 'javascript';

    // Check for TypeScript patterns first (more specific)
    if (LANGUAGE_PATTERNS.typescript.patterns.some(pattern => pattern.test(content))) {
      return 'typescript';
    }

    // Check for JSON patterns
    if (LANGUAGE_PATTERNS.json.patterns.some(pattern => pattern.test(content))) {
      try {
        JSON.parse(trimmedContent);
        return 'json';
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check for CSS patterns
    if (LANGUAGE_PATTERNS.css.patterns.some(pattern => pattern.test(content))) {
      return 'css';
    }

    // Check for HTML patterns
    if (LANGUAGE_PATTERNS.html.patterns.some(pattern => pattern.test(content))) {
      return 'html';
    }

    // Check for JavaScript patterns
    if (LANGUAGE_PATTERNS.javascript.patterns.some(pattern => pattern.test(content))) {
      return 'javascript';
    }

    // Default to JavaScript
    return 'javascript';
  }

  getFileExtension(language: LanguageType): string {
    switch (language) {
      case 'javascript': return '.js';
      case 'typescript': return '.ts';
      case 'json': return '.json';
      case 'css': return '.css';
      case 'html': return '.html';
      default: return '.js';
    }
  }

  getLanguageFromExtension(extension: string): LanguageType | null {
    const ext = extension.toLowerCase();
    for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
      if (config.extensions.includes(ext)) {
        return lang as LanguageType;
      }
    }
    return null;
  }
}