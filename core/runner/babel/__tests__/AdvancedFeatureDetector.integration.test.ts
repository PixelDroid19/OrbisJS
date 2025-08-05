/**
 * Advanced Feature Detector Integration Tests
 * Tests for sophisticated AST-based feature detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedFeatureDetector } from '../AdvancedFeatureDetector';
import type { LanguageFeature, DependencyInfo } from '../types';

describe('AdvancedFeatureDetector Integration Tests', () => {
    let detector: AdvancedFeatureDetector;

    beforeEach(() => {
        detector = new AdvancedFeatureDetector();
    });

    describe('Modern JavaScript Feature Detection', () => {
        it('should detect optional chaining in complex expressions', () => {
            const code = `
        const user = {
          profile: {
            settings: {
              theme: 'dark'
            }
          }
        };
        
        const theme = user?.profile?.settings?.theme;
        const callback = obj?.method?.();
        const computed = data?.items?.[0]?.value;
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'optional-chaining')).toBe(true);
            const optionalChaining = features.find(f => f.name === 'optional-chaining');
            expect(optionalChaining?.requiredPlugin).toBe('@babel/plugin-proposal-optional-chaining');
        });

        it('should detect nullish coalescing with various patterns', () => {
            const code = `
        const config = {
          timeout: userTimeout ?? defaultTimeout ?? 5000,
          retries: options?.retries ?? 3,
          enabled: settings.enabled ?? true
        };
        
        const result = getValue() ?? getDefaultValue() ?? null;
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'nullish-coalescing')).toBe(true);
            const nullishCoalescing = features.find(f => f.name === 'nullish-coalescing');
            expect(nullishCoalescing?.requiredPlugin).toBe('@babel/plugin-proposal-nullish-coalescing-operator');
        });

        it('should detect BigInt literals', () => {
            const code = `
        const largeNumber = 123456789012345678901234567890n;
        const calculation = 42n * 2n;
        const array = [1n, 2n, 3n];
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'bigint')).toBe(true);
        });

        it('should detect dynamic imports', () => {
            const code = `
        async function loadModule() {
          const { default: Component } = await import('./Component');
          const utils = await import('../utils/helpers');
          
          if (condition) {
            const dynamicModule = await import(\`./modules/\${moduleName}\`);
          }
        }
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'dynamic-import')).toBe(true);
        });

        it('should detect top-level await', () => {
            const code = `
        const config = await fetch('/api/config').then(r => r.json());
        const data = await loadData();
        
        export const processedData = await processData(data);
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'top-level-await')).toBe(true);
        });

        it('should detect class properties and methods', () => {
            const code = `
        class Component {
          // Public class property
          state = { count: 0 };
          
          // Private property
          #privateData = 'secret';
          
          // Static property
          static defaultProps = {};
          
          // Private method
          #privateMethod() {
            return this.#privateData;
          }
          
          // Public method with class property syntax
          handleClick = () => {
            this.setState({ count: this.state.count + 1 });
          };
          
          // Static method
          static create() {
            return new Component();
          }
        }
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'class-properties')).toBe(true);
            expect(features.some(f => f.name === 'private-methods')).toBe(true);
            expect(features.some(f => f.name === 'static-class-features')).toBe(true);
        });

        it('should detect decorators', () => {
            const code = `
        @Component({
          selector: 'app-example',
          template: '<div>Example</div>'
        })
        class ExampleComponent {
          @Input() data: string;
          
          @Output() change = new EventEmitter();
          
          @HostListener('click', ['$event'])
          onClick(event: Event) {
            this.change.emit(event);
          }
        }
      `;

            const features = detector.detectModernJSFeatures(code);

            expect(features.some(f => f.name === 'decorators')).toBe(true);
        });
    });

    describe('TypeScript Feature Detection', () => {
        it('should detect interfaces with complex structures', () => {
            const code = `
        interface User {
          id: number;
          name: string;
          email?: string;
          profile: UserProfile;
        }
        
        interface UserProfile {
          avatar: string;
          settings: {
            theme: 'light' | 'dark';
            notifications: boolean;
          };
        }
        
        interface GenericRepository<T, K = string> {
          findById(id: K): Promise<T | null>;
          save(entity: T): Promise<T>;
          delete(id: K): Promise<void>;
        }
      `;

            const features = detector.detectTypeScriptFeatures(code);

            expect(features.some(f => f.name === 'typescript-interfaces')).toBe(true);
            expect(features.some(f => f.name === 'typescript-generics')).toBe(true);
        });

        it('should detect enums with various patterns', () => {
            const code = `
        enum Status {
          Pending,
          Approved,
          Rejected
        }
        
        enum Color {
          Red = '#ff0000',
          Green = '#00ff00',
          Blue = '#0000ff'
        }
        
        const enum Direction {
          Up = 1,
          Down,
          Left,
          Right
        }
      `;

            const features = detector.detectTypeScriptFeatures(code);

            expect(features.some(f => f.name === 'typescript-enums')).toBe(true);
        });

        it('should detect TypeScript decorators', () => {
            const code = `
        @Entity('users')
        class User {
          @PrimaryGeneratedColumn()
          id: number;
          
          @Column({ length: 100 })
          @Index()
          name: string;
          
          @CreateDateColumn()
          createdAt: Date;
          
          @ManyToOne(() => Role)
          role: Role;
        }
      `;

            const features = detector.detectTypeScriptFeatures(code);

            expect(features.some(f => f.name === 'typescript-decorators')).toBe(true);
        });

        it('should detect namespaces and ambient declarations', () => {
            const code = `
        declare global {
          interface Window {
            myApp: MyApp;
          }
        }
        
        namespace Utils {
          export function formatDate(date: Date): string {
            return date.toISOString();
          }
          
          export namespace Validation {
            export function isEmail(email: string): boolean {
              return /^[^@]+@[^@]+$/.test(email);
            }
          }
        }
        
        declare module 'external-lib' {
          export function externalFunction(): void;
        }
      `;

            const features = detector.detectTypeScriptFeatures(code);

            expect(features.some(f => f.name === 'typescript-namespaces')).toBe(true);
            expect(features.some(f => f.name === 'typescript-ambient-declarations')).toBe(true);
        });

        it('should detect type assertions', () => {
            const code = `
        const userInput = document.getElementById('input') as HTMLInputElement;
        const data = response.data as UserData;
        const config = <Config>rawConfig;
        
        function processValue(value: unknown) {
          if (typeof value === 'string') {
            return (value as string).toUpperCase();
          }
          return value as number;
        }
      `;

            const features = detector.detectTypeScriptFeatures(code);

            expect(features.some(f => f.name === 'typescript-type-assertions')).toBe(true);
        });
    });

    describe('Framework Feature Detection', () => {
        it('should detect React features comprehensively', () => {
            const code = `
        import React, { useState, useEffect, useCallback } from 'react';
        
        interface Props {
          initialCount: number;
          onCountChange: (count: number) => void;
        }
        
        const Counter: React.FC<Props> = ({ initialCount, onCountChange }) => {
          const [count, setCount] = useState(initialCount);
          const [history, setHistory] = useState<number[]>([]);
          
          useEffect(() => {
            onCountChange(count);
          }, [count, onCountChange]);
          
          const handleIncrement = useCallback(() => {
            setCount(prev => prev + 1);
            setHistory(prev => [...prev, count + 1]);
          }, [count]);
          
          return (
            <>
              <div>Count: {count}</div>
              <button onClick={handleIncrement}>Increment</button>
              <div>
                History: {history.map(h => <span key={h}>{h}</span>)}
              </div>
            </>
          );
        };
      `;

            const features = detector.detectFrameworkFeatures(code, 'react');

            expect(features.some(f => f.name === 'jsx-elements')).toBe(true);
            expect(features.some(f => f.name === 'jsx-fragments')).toBe(true);
            expect(features.some(f => f.name === 'react-hooks')).toBe(true);
        });

        it('should detect Solid.js features', () => {
            const code = `
        import { createSignal, createEffect, createMemo, For, Show } from 'solid-js';
        
        function TodoApp() {
          const [todos, setTodos] = createSignal([]);
          const [filter, setFilter] = createSignal('all');
          
          const filteredTodos = createMemo(() => {
            const f = filter();
            return todos().filter(todo => 
              f === 'all' || (f === 'completed' && todo.completed) || (f === 'active' && !todo.completed)
            );
          });
          
          createEffect(() => {
            console.log('Todos changed:', todos().length);
          });
          
          return (
            <div>
              <Show when={todos().length > 0}>
                <For each={filteredTodos()}>
                  {(todo) => (
                    <div class={todo.completed ? 'completed' : ''}>
                      {todo.text}
                    </div>
                  )}
                </For>
              </Show>
            </div>
          );
        }
      `;

            const features = detector.detectFrameworkFeatures(code, 'solid');

            expect(features.some(f => f.name === 'solid-jsx')).toBe(true);
            expect(features.some(f => f.name === 'solid-reactivity')).toBe(true);
        });

        it('should detect Vue 3 Composition API features', () => {
            const code = `
        import { defineComponent, ref, reactive, computed, watch, onMounted } from 'vue';
        
        export default defineComponent({
          name: 'UserProfile',
          props: {
            userId: {
              type: String,
              required: true
            }
          },
          setup(props) {
            const user = ref(null);
            const loading = ref(false);
            const preferences = reactive({
              theme: 'light',
              notifications: true
            });
            
            const displayName = computed(() => {
              return user.value ? \`\${user.value.firstName} \${user.value.lastName}\` : '';
            });
            
            watch(() => props.userId, async (newId) => {
              if (newId) {
                loading.value = true;
                user.value = await fetchUser(newId);
                loading.value = false;
              }
            });
            
            onMounted(() => {
              console.log('Component mounted');
            });
            
            return {
              user,
              loading,
              preferences,
              displayName
            };
          }
        });
      `;

            const features = detector.detectFrameworkFeatures(code, 'vue');

            // Vue features should be detected (fallback to pattern-based detection)
            expect(features.length).toBeGreaterThan(0);
            // At least one Vue feature should be detected
            expect(features.some(f => f.name.includes('vue'))).toBe(true);
        });
    });

    describe('Dependency Analysis', () => {
        it('should analyze dependency requirements from detected features', () => {
            const features: LanguageFeature[] = [
                {
                    name: 'optional-chaining',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/plugin-proposal-optional-chaining'
                },
                {
                    name: 'nullish-coalescing',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/plugin-proposal-nullish-coalescing-operator'
                },
                {
                    name: 'typescript-interfaces',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/preset-typescript'
                },
                {
                    name: 'jsx-elements',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/preset-react'
                }
            ];

            const dependencies = detector.analyzeDependencyRequirements(features);

            expect(dependencies).toHaveLength(4);
            expect(dependencies.some(d => d.name === '@babel/plugin-proposal-optional-chaining')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/plugin-proposal-nullish-coalescing-operator')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/preset-typescript')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/preset-react')).toBe(true);

            // Check dependency types
            const pluginDeps = dependencies.filter(d => d.type === 'babel-plugin');
            const presetDeps = dependencies.filter(d => d.type === 'babel-preset');

            expect(pluginDeps).toHaveLength(2);
            expect(presetDeps).toHaveLength(2);
        });

        it('should avoid duplicate dependencies', () => {
            const features: LanguageFeature[] = [
                {
                    name: 'typescript-interfaces',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/preset-typescript'
                },
                {
                    name: 'typescript-enums',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/preset-typescript'
                },
                {
                    name: 'typescript-generics',
                    type: 'syntax',
                    support: { native: false, transpilable: true },
                    requiredPlugin: '@babel/preset-typescript'
                }
            ];

            const dependencies = detector.analyzeDependencyRequirements(features);

            expect(dependencies).toHaveLength(1);
            expect(dependencies[0].name).toBe('@babel/preset-typescript');
            expect(dependencies[0].type).toBe('babel-preset');
        });
    });

    describe('Complex Real-world Scenarios', () => {
        it('should handle mixed TypeScript + React + Modern JS features', () => {
            const code = `
        import React, { useState, useEffect } from 'react';
        
        interface User {
          id: number;
          name: string;
          email?: string;
        }
        
        interface Props {
          userId: number;
          onUserLoad?: (user: User) => void;
        }
        
        const UserProfile: React.FC<Props> = ({ userId, onUserLoad }) => {
          const [user, setUser] = useState<User | null>(null);
          const [loading, setLoading] = useState(false);
          
          useEffect(() => {
            const loadUser = async () => {
              setLoading(true);
              try {
                const response = await fetch(\`/api/users/\${userId}\`);
                const userData = await response.json();
                setUser(userData);
                onUserLoad?.(userData);
              } catch (error) {
                console.error('Failed to load user:', error);
              } finally {
                setLoading(false);
              }
            };
            
            loadUser();
          }, [userId, onUserLoad]);
          
          const displayName = user?.name ?? 'Unknown User';
          const contactInfo = user?.email ?? 'No email provided';
          
          return (
            <div className="user-profile">
              {loading ? (
                <div>Loading...</div>
              ) : (
                <>
                  <h1>{displayName}</h1>
                  <p>{contactInfo}</p>
                  <div>User ID: {user?.id}</div>
                </>
              )}
            </div>
          );
        };
        
        export default UserProfile;
      `;

            // Test TypeScript features
            const tsFeatures = detector.detectTypeScriptFeatures(code);
            expect(tsFeatures.some(f => f.name === 'typescript-interfaces')).toBe(true);

            // Test React features
            const reactFeatures = detector.detectFrameworkFeatures(code, 'react');
            expect(reactFeatures.some(f => f.name === 'jsx-elements')).toBe(true);
            expect(reactFeatures.some(f => f.name === 'jsx-fragments')).toBe(true);
            expect(reactFeatures.some(f => f.name === 'react-hooks')).toBe(true);

            // Test modern JS features
            const jsFeatures = detector.detectModernJSFeatures(code);
            expect(jsFeatures.some(f => f.name === 'optional-chaining')).toBe(true);
            expect(jsFeatures.some(f => f.name === 'nullish-coalescing')).toBe(true);

            // Test combined dependency analysis
            const allFeatures = [...tsFeatures, ...reactFeatures, ...jsFeatures];
            const dependencies = detector.analyzeDependencyRequirements(allFeatures);

            expect(dependencies.some(d => d.name === '@babel/preset-typescript')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/preset-react')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/plugin-proposal-optional-chaining')).toBe(true);
            expect(dependencies.some(d => d.name === '@babel/plugin-proposal-nullish-coalescing-operator')).toBe(true);
        });

        it('should handle edge cases and malformed code gracefully', () => {
            const malformedCode = `
        const incomplete = {
          prop: value?.
        // Missing closing brace and incomplete optional chaining
      `;

            expect(() => {
                const features = detector.detectModernJSFeatures(malformedCode);
                // Should not throw and should return some features via fallback
                expect(Array.isArray(features)).toBe(true);
            }).not.toThrow();
        });
    });
});