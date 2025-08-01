import { Extension, Compartment } from '@codemirror/state';
import { javascript, autoCloseTags } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { linter } from '@codemirror/lint';
import { basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { LanguageType } from './types';
import { CompletionService } from './CompletionService';

export class CodeMirrorExtensions {
  private languageCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private completionCompartment = new Compartment();

  getLanguageExtension(language: LanguageType): Extension {
    switch (language) {
      case 'javascript':
        return [javascript({ jsx: true }), autoCloseTags];
      case 'typescript':
        return [javascript({ typescript: true, jsx: true }), autoCloseTags];
      case 'json':
        return json();
      case 'css':
        return css();
      case 'html':
        return html();
      default:
        return [javascript(), autoCloseTags];
    }
  }

  getCompletionExtensions(language: LanguageType, autoComplete: boolean): Extension[] {
    if (!autoComplete) return [];
    
    const extensions: Extension[] = [];
    
    if (language === 'javascript') {
      // Usar las extensiones nativas completas de JavaScript de CodeMirror (incluye JSDoc)
      extensions.push(CompletionService.getJavaScriptCompletions());
    } else if (language === 'typescript') {
      // Usar las extensiones específicas de TypeScript (incluye JSDoc)
      extensions.push(CompletionService.getTypeScriptCompletions());
    }
    
    return extensions;
  }

  createBaseExtensions(config: {
    theme: string;
    tabSize: number;
    linting: boolean;
    language: LanguageType;
    autoComplete: boolean;
  }): Extension[] {
    const extensions: Extension[] = [
      basicSetup,
      
      // Tab support for indentation
      keymap.of([indentWithTab]),
      indentUnit.of(config.tabSize === 4 ? "    " : "  "),
      
      // Search keymap
      keymap.of(searchKeymap),
      
      // Compartments for dynamic reconfiguration
      this.languageCompartment.of(this.getLanguageExtension(config.language)),
      this.themeCompartment.of(config.theme === 'dark' ? oneDark : []),
      this.completionCompartment.of(this.getCompletionExtensions(config.language, config.autoComplete)),
    ];

    // Add basic linting
    if (config.linting) {
      extensions.push(linter(() => []));
    }

    return extensions;
  }

  getCompartments() {
    return {
      language: this.languageCompartment,
      theme: this.themeCompartment,
      completion: this.completionCompartment
    };
  }
}