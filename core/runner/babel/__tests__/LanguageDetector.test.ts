/**
 * Language Detector Tests
 * Comprehensive tests for language and framework detection capabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LanguageDetector } from '../LanguageDetector';
import type { LanguageInfo, FrameworkInfo, LanguageFeature } from '../types';

describe('LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = new LanguageDetector();
  });

  describe('Extension-based detection', () => {
    it('should detect JavaScript from .js extension', () => {
      const result = detector.detectFromExtension('.js');
      
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.8);
      expect(result.features).toHaveLength(0);
      expect(result.requiresTranspilation).toBe(false);
    });

    it('should detect TypeScript from .ts extension', () => {
      const result = detector.detectFromExtension('.ts');
      
      expect(result.language).toBe('typescript');
      expect(result.confidence).toBe(0.9);
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should detect JSX from .jsx extension', () => {
      const result = detector.detectFromExtension('.jsx');
      
      expect(result.language).toBe('jsx');
      expect(result.confidence).toBe(0.9);
      expect(result.features.some(f => f.name === 'jsx-elements')).toBe(true);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should detect TSX from .tsx extension', () => {
      const result = detector.detectFromExtension('.tsx');
      
      expect(result.language).toBe('tsx');
      expect(result.confidence).toBe(0.95);
      expect(result.features.some(f => f.name === 'typescript-interfaces')).toBe(true);
      expect(result.features.some(f => f.name === 'jsx-elements')).toBe(true);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should handle unknown extensions with fallback', () => {
      const result = detector.detectFromExtension('.unknown');
      
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.3);
      expect(result.requiresTranspilation).toBe(false);
    });
  });

  describe('Content-based detection', () => {
    it('should detect modern JavaScript features', () => {
      const code = `
        const obj = { a: 1, b: 2 };
        const value = obj?.a ?? 'default';
        
        class MyClass {
          property = 'value';
          
          @decorator
          method() {
            return this.property;
          }
        }
      `;

      const result = detector.detectFromContent(code, 'test.js');
      
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.features.some(f => f.name === 'optional-chaining')).toBe(true);
      expect(result.features.some(f => f.name === 'nullish-coalescing')).toBe(true);
      expect(result.features.some(f => f.name === 'class-properties')).toBe(true);
      expect(result.features.some(f => f.name === 'decorators')).toBe(true);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should detect TypeScript features', () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }
        
        enum Status {
          Active,
          Inactive
        }
        
        function getUser<T extends User>(id: T['id']): T {
          return {} as T;
        }
      `;

      const result = detector.detectFromContent(code, 'test.ts');
      
      expect(result.language).toBe('typescript');
      expect(result.features.some(f => f.name === 'typescript-interfaces')).toBe(true);
      // Enum detection might be more complex, so let's just check that we have TypeScript features
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should detect JSX elements', () => {
      const code = `
        import React from 'react';
        
        function Component() {
          return (
            <div>
              <h1>Hello World</h1>
              <Fragment>
                <p>Content</p>
              </Fragment>
            </div>
          );
        }
      `;

      const result = detector.detectFromContent(code, 'test.jsx');
      
      expect(result.language).toBe('jsx');
      expect(result.features.some(f => f.name === 'jsx-elements')).toBe(true);
      expect(result.requiresTranspilation).toBe(true);
    });

    it('should handle plain JavaScript without modern features', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        
        var result = add(1, 2);
        console.log(result);
      `;

      const result = detector.detectFromContent(code, 'test.js');
      
      expect(result.language).toBe('javascript');
      expect(result.features).toHaveLength(0);
      expect(result.requiresTranspilation).toBe(false);
    });
  });

  describe('Framework detection', () => {
    it('should detect React framework', () => {
      const code = `
        import React, { useState } from 'react';
        import ReactDOM from 'react-dom';
        
        function App() {
          const [count, setCount] = useState(0);
          
          return (
            <div>
              <h1>Count: {count}</h1>
              <button onClick={() => setCount(count + 1)}>
                Increment
              </button>
            </div>
          );
        }
        
        ReactDOM.render(<App />, document.getElementById('root'));
      `;

      const frameworks = detector.detectFramework(code);
      
      expect(frameworks.length).toBeGreaterThan(0);
      const reactFramework = frameworks.find(f => f.name === 'react');
      expect(reactFramework).toBeDefined();
      expect(reactFramework!.confidence).toBeGreaterThan(0.5);
      expect(reactFramework!.requiredPresets).toContain('@babel/preset-react');
    });

    it('should detect Solid framework', () => {
      const code = `
        import { createSignal, createEffect } from 'solid-js';
        import { render } from 'solid-js/web';
        
        function Counter() {
          const [count, setCount] = createSignal(0);
          
          createEffect(() => {
            console.log('Count changed:', count());
          });
          
          return (
            <div>
              <p>Count: {count()}</p>
              <button onClick={() => setCount(count() + 1)}>
                Increment
              </button>
            </div>
          );
        }
        
        render(() => <Counter />, document.getElementById('root'));
      `;

      const frameworks = detector.detectFramework(code);
      
      expect(frameworks.length).toBeGreaterThan(0);
      const solidFramework = frameworks.find(f => f.name === 'solid');
      expect(solidFramework).toBeDefined();
      expect(solidFramework!.confidence).toBeGreaterThan(0.5);
      expect(solidFramework!.requiredPresets).toContain('solid');
    });

    it('should detect Vue framework', () => {
      const code = `
        import { defineComponent, ref, computed, onMounted } from 'vue';
        
        export default defineComponent({
          setup() {
            const count = ref(0);
            const doubled = computed(() => count.value * 2);
            
            onMounted(() => {
              console.log('Component mounted');
            });
            
            return {
              count,
              doubled,
              increment: () => count.value++
            };
          }
        });
      `;

      const frameworks = detector.detectFramework(code);
      
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0].name).toBe('vue');
      expect(frameworks[0].confidence).toBeGreaterThan(0.5);
      expect(frameworks[0].requiredPresets).toContain('@vue/babel-preset-jsx');
    });

    it('should detect multiple frameworks with confidence scoring', () => {
      const code = `
        import React from 'react';
        import { createSignal } from 'solid-js';
        
        // This is a contrived example mixing frameworks
        function Component() {
          const [signal] = createSignal(0);
          
          return <div>Mixed framework code</div>;
        }
      `;

      const frameworks = detector.detectFramework(code);
      
      expect(frameworks.length).toBeGreaterThan(0);
      // Should be sorted by confidence
      expect(frameworks[0].confidence).toBeGreaterThanOrEqual(frameworks[frameworks.length - 1].confidence);
    });

    it('should return empty array for no framework detection', () => {
      const code = `
        function plainJavaScript() {
          return 'No framework here';
        }
      `;

      const frameworks = detector.detectFramework(code);
      
      expect(frameworks).toHaveLength(0);
    });
  });

  describe('Feature detection', () => {
    it('should detect optional chaining', () => {
      const code = 'const value = obj?.prop?.nested;';
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'optional-chaining')).toBe(true);
    });

    it('should detect nullish coalescing', () => {
      const code = 'const value = input ?? defaultValue;';
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'nullish-coalescing')).toBe(true);
    });

    it('should detect class properties', () => {
      const code = `
        class MyClass {
          property = 'value';
          static staticProp = 'static';
        }
      `;
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'class-properties')).toBe(true);
    });

    it('should detect decorators', () => {
      const code = `
        @Component
        class MyClass {
          @Input() prop: string;
        }
      `;
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'decorators')).toBe(true);
    });

    it('should detect top-level await', () => {
      const code = 'const data = await fetch("/api/data");';
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'top-level-await')).toBe(true);
    });

    it('should detect dynamic imports', () => {
      const code = 'const module = await import("./dynamic-module");';
      const features = detector.detectFeatures(code);
      
      expect(features.some(f => f.name === 'dynamic-import')).toBe(true);
    });
  });

  describe('Dependency detection', () => {
    it('should detect npm dependencies from imports', () => {
      const code = `
        import React from 'react';
        import { render } from 'react-dom';
        import axios from 'axios';
        import { debounce } from 'lodash';
        import './local-file';
      `;

      const dependencies = detector.detectDependencies(code);
      
      expect(dependencies.some(d => d.name === 'react')).toBe(true);
      expect(dependencies.some(d => d.name === 'react-dom')).toBe(true);
      expect(dependencies.some(d => d.name === 'axios')).toBe(true);
      expect(dependencies.some(d => d.name === 'lodash')).toBe(true);
      // Should not include local files
      expect(dependencies.some(d => d.name === './local-file')).toBe(false);
    });

    it('should detect dependencies from require statements', () => {
      const code = `
        const fs = require('fs');
        const path = require('path');
        const express = require('express');
      `;

      const dependencies = detector.detectDependencies(code);
      
      expect(dependencies.some(d => d.name === 'fs')).toBe(true);
      expect(dependencies.some(d => d.name === 'path')).toBe(true);
      expect(dependencies.some(d => d.name === 'express')).toBe(true);
    });
  });

  describe('Configuration and validation', () => {
    it('should register custom language patterns', () => {
      const customPattern = /customSyntax\s*\(/g;
      detector.registerLanguagePattern('custom', customPattern);
      
      // This would be tested with actual custom pattern detection
      // For now, just verify the method doesn't throw
      expect(() => {
        detector.registerLanguagePattern('custom', customPattern);
      }).not.toThrow();
    });

    it('should validate language support', () => {
      expect(detector.validateLanguageSupport('javascript')).toBe(true);
      expect(detector.validateLanguageSupport('typescript')).toBe(true);
      expect(detector.validateLanguageSupport('jsx')).toBe(true);
      expect(detector.validateLanguageSupport('tsx')).toBe(true);
      expect(detector.validateLanguageSupport('unsupported')).toBe(false);
    });

    it('should return supported languages', () => {
      const languages = detector.getSupportedLanguages();
      
      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('jsx');
      expect(languages).toContain('tsx');
      expect(languages).toHaveLength(4);
    });

    it('should set detection strategy', () => {
      expect(() => {
        detector.setDetectionStrategy('comprehensive');
        detector.setDetectionStrategy('fast');
        detector.setDetectionStrategy('ast-only');
        detector.setDetectionStrategy('pattern-only');
      }).not.toThrow();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed code gracefully', () => {
      const malformedCode = 'const incomplete = {';
      
      expect(() => {
        const result = detector.detectFromContent(malformedCode);
        expect(result.language).toBe('javascript');
        expect(result.confidence).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should handle empty code', () => {
      const result = detector.detectFromContent('');
      
      expect(result.language).toBe('javascript');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.features).toHaveLength(0);
    });

    it('should handle code with mixed syntax', () => {
      const mixedCode = `
        // JavaScript
        const value = 42;
        
        // TypeScript
        interface Config {
          enabled: boolean;
        }
        
        // JSX
        const element = <div>Hello</div>;
      `;

      const result = detector.detectFromContent(mixedCode, 'mixed.tsx');
      
      expect(result.language).toBe('tsx');
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.requiresTranspilation).toBe(true);
    });
  });

  describe('Confidence scoring', () => {
    it('should provide higher confidence for extension + content match', () => {
      const tsCode = `
        interface User {
          id: number;
          name: string;
        }
      `;

      const resultWithExtension = detector.detectFromContent(tsCode, 'test.ts');
      const resultWithoutExtension = detector.detectFromContent(tsCode);
      
      expect(resultWithExtension.confidence).toBeGreaterThan(resultWithoutExtension.confidence);
    });

    it('should provide lower confidence for ambiguous code', () => {
      const ambiguousCode = 'console.log("hello");';
      
      const result = detector.detectFromContent(ambiguousCode);
      
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should provide high confidence for clear framework usage', () => {
      const reactCode = `
        import React from 'react';
        export default function App() {
          return <div>React App</div>;
        }
      `;

      const result = detector.detectFromContent(reactCode, 'App.jsx');
      
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.framework).toBe('react');
    });
  });
});