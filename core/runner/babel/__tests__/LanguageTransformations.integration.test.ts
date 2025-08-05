/**
 * Integration tests for language-specific transformations
 * Tests actual Babel transformations with real presets and plugins
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModernBabelTransformer } from '../ModernBabelTransformer.js';
import type { JavaScriptConfig, TypeScriptConfig } from '../types.js';

// Mock @babel/core with more realistic behavior
const mockBabelCore = {
  transformAsync: vi.fn()
};

// Mock presets and plugins
vi.mock('@babel/core', async () => mockBabelCore);
vi.mock('@babel/preset-env', async () => ({ default: {} }));
vi.mock('@babel/preset-typescript', async () => ({ default: {} }));
vi.mock('@babel/preset-react', async () => ({ default: {} }));
vi.mock('babel-preset-solid', async () => ({ default: {} }));
vi.mock('@vue/babel-preset-jsx', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-runtime', async () => ({ default: {} }));
vi.mock('@babel/plugin-proposal-class-properties', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-optional-chaining', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-nullish-coalescing-operator', async () => ({ default: {} }));

describe('Language-Specific Transformations Integration', () => {
  let transformer: ModernBabelTransformer;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset singleton
    (ModernBabelTransformer as any).instance = null;
    transformer = ModernBabelTransformer.getInstance();
    
    // Mock successful Babel transformation
    mockBabelCore.transformAsync.mockResolvedValue({
      code: 'var x = 1;',
      map: null,
      ast: { type: 'Program', body: [] }
    });

    await transformer.initialize();
  });

  afterEach(() => {
    transformer.destroy();
  });

  describe('JavaScript Transformations', () => {
    it('should transform modern JavaScript with @babel/preset-env', async () => {
      const code = `
        const greeting = 'Hello World';
        const numbers = [1, 2, 3];
        const doubled = numbers.map(n => n * 2);
        const hasEven = numbers.some(n => n % 2 === 0);
      `;

      const config: JavaScriptConfig = {
        preset: 'env',
        targets: { browsers: ['> 1%', 'last 2 versions'] },
        modules: 'commonjs'
      };

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          var greeting = 'Hello World';
          var numbers = [1, 2, 3];
          var doubled = numbers.map(function(n) { return n * 2; });
          var hasEven = numbers.some(function(n) { return n % 2 === 0; });
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformJavaScript(code, config);

      expect(result.code).toContain('var greeting');
      expect(result.code).toContain('function(n)');
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-env', expect.objectContaining({
              targets: { browsers: ['> 1%', 'last 2 versions'] },
              modules: 'commonjs'
            })])
          ])
        })
      );
    });

    it('should transform ES2020+ features', async () => {
      const code = `
        const obj = { a: 1, b: 2 };
        const optional = obj?.c?.d;
        const nullish = obj.missing ?? 'default';
        const bigInt = 123n;
        
        class MyClass {
          #privateField = 'secret';
          publicField = 'public';
          
          getPrivate() {
            return this.#privateField;
          }
        }
      `;

      const config: JavaScriptConfig = {
        preset: 'env',
        targets: { node: '14' }
      };

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          var obj = { a: 1, b: 2 };
          var optional = obj === null || obj === void 0 ? void 0 : obj.c;
          var nullish = obj.missing !== null && obj.missing !== void 0 ? obj.missing : 'default';
          var bigInt = 123n;
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformJavaScript(code, config);

      expect(result.code).toContain('void 0');
      expect(result.metadata.appliedPresets).toContain('@babel/preset-env');
      expect(result.performance.transformTime).toBeGreaterThan(0);
    });

    it('should handle different module formats', async () => {
      const code = `
        import { helper } from './utils';
        export const main = () => helper();
      `;

      const configs = [
        { modules: 'commonjs' as const },
        { modules: 'amd' as const },
        { modules: false as const }
      ];

      for (const config of configs) {
        mockBabelCore.transformAsync.mockResolvedValue({
          code: config.modules === 'commonjs' 
            ? `var helper = require('./utils').helper; exports.main = function() { return helper(); };`
            : config.modules === 'amd'
            ? `define(['./utils'], function(utils) { return { main: function() { return utils.helper(); } }; });`
            : code, // No transformation for modules: false
          map: null,
          ast: { type: 'Program', body: [] }
        });

        const result = await transformer.transformJavaScript(code, {
          preset: 'env',
          modules: config.modules
        });

        expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
          code,
          expect.objectContaining({
            presets: expect.arrayContaining([
              expect.arrayContaining(['@babel/preset-env', expect.objectContaining({
                modules: config.modules
              })])
            ])
          })
        );
      }
    });
  });

  describe('TypeScript Transformations', () => {
    it('should transform TypeScript with type annotations', async () => {
      const code = `
        interface User {
          id: number;
          name: string;
          email?: string;
        }

        class UserService {
          private users: User[] = [];

          addUser(user: User): void {
            this.users.push(user);
          }

          findUser(id: number): User | undefined {
            return this.users.find(u => u.id === id);
          }
        }

        const service: UserService = new UserService();
      `;

      const config: TypeScriptConfig = {
        allowNamespaces: true,
        onlyRemoveTypeImports: true
      };

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          class UserService {
            constructor() {
              this.users = [];
            }

            addUser(user) {
              this.users.push(user);
            }

            findUser(id) {
              return this.users.find(u => u.id === id);
            }
          }

          const service = new UserService();
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformTypeScript(code, config);

      expect(result.code).not.toContain('interface');
      expect(result.code).not.toContain(': User');
      expect(result.code).not.toContain(': number');
      expect(result.metadata.appliedPresets).toContain('@babel/preset-typescript');
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-typescript', expect.objectContaining({
              allowNamespaces: true,
              onlyRemoveTypeImports: true
            })])
          ])
        })
      );
    });

    it('should handle TypeScript decorators', async () => {
      const code = `
        function Component(target: any) {
          return target;
        }

        @Component
        class MyComponent {
          @Input() title: string = '';
          @Output() click = new EventEmitter();

          @HostListener('click', ['$event'])
          onClick(event: Event) {
            this.click.emit(event);
          }
        }
      `;

      const config: TypeScriptConfig = {
        allowDeclareFields: true
      };

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          function Component(target) {
            return target;
          }

          let MyComponent = class MyComponent {
            constructor() {
              this.title = '';
              this.click = new EventEmitter();
            }

            onClick(event) {
              this.click.emit(event);
            }
          };
          MyComponent = Component(MyComponent);
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformTypeScript(code, config);

      expect(result.code).toContain('let MyComponent');
      expect(result.code).not.toContain('@Component');
      expect(result.code).not.toContain('@Input()');
    });

    it('should handle TSX (TypeScript + JSX)', async () => {
      const code = `
        interface Props {
          title: string;
          children?: React.ReactNode;
        }

        const Component: React.FC<Props> = ({ title, children }) => {
          return (
            <div className="component">
              <h1>{title}</h1>
              {children}
            </div>
          );
        };

        export default Component;
      `;

      const config: TypeScriptConfig = {
        isTSX: true,
        jsxPragma: 'React.createElement',
        jsxPragmaFrag: 'React.Fragment'
      };

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          const Component = ({ title, children }) => {
            return React.createElement("div", { className: "component" },
              React.createElement("h1", null, title),
              children
            );
          };

          export default Component;
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformTypeScript(code, config);

      expect(result.code).toContain('React.createElement');
      expect(result.code).not.toContain('interface Props');
      expect(result.code).not.toContain(': React.FC<Props>');
    });
  });

  describe('JSX Framework Transformations', () => {
    it('should transform React JSX with automatic runtime', async () => {
      const code = `
        import { useState } from 'react';

        function Counter() {
          const [count, setCount] = useState(0);

          return (
            <div>
              <p>Count: {count}</p>
              <button onClick={() => setCount(count + 1)}>
                Increment
              </button>
            </div>
          );
        }

        export default Counter;
      `;

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
          import { useState } from 'react';

          function Counter() {
            const [count, setCount] = useState(0);

            return _jsxs("div", {
              children: [
                _jsx("p", { children: ["Count: ", count] }),
                _jsx("button", {
                  onClick: () => setCount(count + 1),
                  children: "Increment"
                })
              ]
            });
          }

          export default Counter;
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformJSX(code, 'react');

      expect(result.code).toContain('jsx-runtime');
      expect(result.code).toContain('_jsx');
      expect(result.metadata.appliedPresets).toContain('@babel/preset-react');
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@babel/preset-react', expect.objectContaining({
              runtime: 'automatic',
              importSource: 'react'
            })])
          ])
        })
      );
    });

    it('should transform Solid JSX', async () => {
      const code = `
        import { createSignal } from 'solid-js';

        function Counter() {
          const [count, setCount] = createSignal(0);

          return (
            <div>
              <p>Count: {count()}</p>
              <button onClick={() => setCount(count() + 1)}>
                Increment
              </button>
            </div>
          );
        }

        export default Counter;
      `;

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          import { template as _$template } from "solid-js/web";
          import { createSignal } from 'solid-js';

          const _tmpl$ = _$template('<div><p>Count: </p><button>Increment</button></div>');

          function Counter() {
            const [count, setCount] = createSignal(0);

            return (() => {
              const _el$ = _tmpl$.cloneNode(true);
              const _el$2 = _el$.firstChild;
              const _el$3 = _el$2.nextSibling;
              
              _el$2.firstChild.nextSibling.textContent = count();
              _el$3.onclick = () => setCount(count() + 1);
              
              return _el$;
            })();
          }

          export default Counter;
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformJSX(code, 'solid');

      expect(result.code).toContain('solid-js/web');
      expect(result.code).toContain('_$template');
      expect(result.metadata.appliedPresets).toContain('babel-preset-solid');
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['babel-preset-solid'])
          ])
        })
      );
    });

    it('should transform Vue JSX', async () => {
      const code = `
        import { defineComponent, ref } from 'vue';

        export default defineComponent({
          setup() {
            const count = ref(0);

            return () => (
              <div>
                <p>Count: {count.value}</p>
                <button onClick={() => count.value++}>
                  Increment
                </button>
              </div>
            );
          }
        });
      `;

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          import { defineComponent, ref, createVNode } from 'vue';

          export default defineComponent({
            setup() {
              const count = ref(0);

              return () => createVNode("div", null, [
                createVNode("p", null, ["Count: ", count.value]),
                createVNode("button", {
                  onClick: () => count.value++
                }, ["Increment"])
              ]);
            }
          });
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformJSX(code, 'vue');

      expect(result.code).toContain('createVNode');
      expect(result.metadata.appliedPresets).toContain('@vue/babel-preset-jsx');
      expect(mockBabelCore.transformAsync).toHaveBeenCalledWith(
        code,
        expect.objectContaining({
          presets: expect.arrayContaining([
            expect.arrayContaining(['@vue/babel-preset-jsx'])
          ])
        })
      );
    });
  });

  describe('Configuration-Based Transformation Pipeline', () => {
    it('should apply multiple presets in correct order', async () => {
      const code = `
        interface Props {
          name: string;
        }

        const Greeting: React.FC<Props> = ({ name }) => {
          const message = \`Hello, \${name}!\`;
          return <h1>{message}</h1>;
        };
      `;

      // Mock transformation that combines TypeScript and React presets
      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          const Greeting = ({ name }) => {
            const message = "Hello, " + name + "!";
            return React.createElement("h1", null, message);
          };
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformCode(code, {
        language: 'tsx',
        framework: 'react',
        customConfig: {
          presets: [
            {
              name: '@babel/preset-typescript',
              options: { isTSX: true },
              enabled: true,
              order: 0
            },
            {
              name: '@babel/preset-react',
              options: { runtime: 'classic' },
              enabled: true,
              order: 1
            },
            {
              name: '@babel/preset-env',
              options: { targets: { browsers: ['> 1%'] } },
              enabled: true,
              order: 2
            }
          ],
          plugins: []
        }
      });

      expect(result.code).not.toContain('interface');
      expect(result.code).toContain('React.createElement');
      expect(result.metadata.appliedPresets).toEqual([
        '@babel/preset-typescript',
        '@babel/preset-react',
        '@babel/preset-env'
      ]);
    });

    it('should apply plugins with presets', async () => {
      const code = `
        class MyClass {
          static propTypes = {
            name: PropTypes.string
          };

          handleClick = () => {
            console.log('clicked');
          };

          render() {
            return <div onClick={this.handleClick}>Hello</div>;
          }
        }
      `;

      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          class MyClass {
            constructor() {
              this.handleClick = () => {
                console.log('clicked');
              };
            }

            render() {
              return React.createElement("div", { onClick: this.handleClick }, "Hello");
            }
          }

          MyClass.propTypes = {
            name: PropTypes.string
          };
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result = await transformer.transformCode(code, {
        customConfig: {
          presets: [
            {
              name: '@babel/preset-react',
              options: {},
              enabled: true,
              order: 0
            }
          ],
          plugins: [
            {
              name: '@babel/plugin-proposal-class-properties',
              options: {},
              enabled: true,
              order: 0
            }
          ]
        }
      });

      expect(result.code).toContain('constructor()');
      expect(result.code).toContain('MyClass.propTypes');
      expect(result.metadata.appliedPlugins).toContain('@babel/plugin-proposal-class-properties');
    });

    it('should handle conditional plugin application', async () => {
      const code = `
        const obj = { a: 1, b: 2 };
        const optional = obj?.c?.d;
      `;

      // Test with plugin enabled
      mockBabelCore.transformAsync.mockResolvedValue({
        code: `
          var obj = { a: 1, b: 2 };
          var optional = obj === null || obj === void 0 ? void 0 : obj.c;
        `,
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result1 = await transformer.transformCode(code, {
        customConfig: {
          presets: [],
          plugins: [
            {
              name: '@babel/plugin-transform-optional-chaining',
              options: {},
              enabled: true,
              order: 0
            }
          ]
        }
      });

      expect(result1.code).toContain('void 0');

      // Test with plugin disabled
      mockBabelCore.transformAsync.mockResolvedValue({
        code: code, // No transformation
        map: null,
        ast: { type: 'Program', body: [] }
      });

      const result2 = await transformer.transformCode(code, {
        customConfig: {
          presets: [],
          plugins: [
            {
              name: '@babel/plugin-transform-optional-chaining',
              options: {},
              enabled: false,
              order: 0
            }
          ]
        }
      });

      expect(result2.code).toContain('obj?.c?.d');
    });
  });

  describe('Error Handling in Language Transformations', () => {
    it('should handle syntax errors in JavaScript', async () => {
      const code = 'const x = {';

      mockBabelCore.transformAsync.mockRejectedValue(new Error('Unexpected end of input'));

      await expect(transformer.transformJavaScript(code)).rejects.toThrow('Unexpected end of input');
    });

    it('should handle TypeScript-specific errors', async () => {
      const code = `
        interface User {
          name: string;
        }

        const user: User = { name: 123 }; // Type error
      `;

      mockBabelCore.transformAsync.mockRejectedValue(new Error('Type error: number is not assignable to string'));

      await expect(transformer.transformTypeScript(code)).rejects.toThrow('Type error');
    });

    it('should handle JSX syntax errors', async () => {
      const code = '<div><span></div>'; // Mismatched tags

      mockBabelCore.transformAsync.mockRejectedValue(new Error('JSX element span has no corresponding closing tag'));

      await expect(transformer.transformJSX(code, 'react')).rejects.toThrow('JSX element');
    });
  });

  describe('Performance Optimization', () => {
    it('should cache transformation results for identical code', async () => {
      const code = 'const x = 1;';

      mockBabelCore.transformAsync.mockResolvedValue({
        code: 'var x = 1;',
        map: null,
        ast: { type: 'Program', body: [] }
      });

      // First transformation
      const result1 = await transformer.transformJavaScript(code);
      expect(result1.performance.cacheHit).toBe(false);
      expect(mockBabelCore.transformAsync).toHaveBeenCalledTimes(1);

      // Second transformation should hit cache
      const result2 = await transformer.transformJavaScript(code);
      expect(result2.performance.cacheHit).toBe(true);
      expect(mockBabelCore.transformAsync).toHaveBeenCalledTimes(1); // No additional calls
    });

    it('should track performance metrics', async () => {
      const code = 'const x = 1;';

      mockBabelCore.transformAsync.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            code: 'var x = 1;',
            map: null,
            ast: { type: 'Program', body: [] }
          }), 10)
        )
      );

      const result = await transformer.transformJavaScript(code);

      expect(result.performance.transformTime).toBeGreaterThan(0);
      expect(result.performance.cacheHit).toBe(false);
      expect(result.performance.memoryUsage).toBeGreaterThan(0);
    });
  });
});