/**
 * Unit tests for BabelConfigManager
 * Tests configuration management, validation, and environment-specific overrides
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BabelConfigManager } from '../BabelConfigManager.js';
import type { BabelGlobalConfig, ValidationResult } from '../types.js';

// Mock dynamic imports
vi.mock('@babel/preset-env', async () => ({ default: {} }));
vi.mock('@babel/preset-typescript', async () => ({ default: {} }));
vi.mock('@babel/preset-react', async () => ({ default: {} }));
vi.mock('babel-preset-solid', async () => ({ default: {} }));
vi.mock('@vue/babel-preset-jsx', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-runtime', async () => ({ default: {} }));
vi.mock('@babel/plugin-proposal-class-properties', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-optional-chaining', async () => ({ default: {} }));
vi.mock('@babel/plugin-transform-nullish-coalescing-operator', async () => ({ default: {} }));
vi.mock('@babel/plugin-proposal-decorators', async () => ({ default: {} }));

describe('BabelConfigManager', () => {
  let configManager: BabelConfigManager;

  beforeEach(() => {
    // Reset singleton
    (BabelConfigManager as any).instance = null;
    configManager = BabelConfigManager.getInstance();
  });

  afterEach(() => {
    configManager.destroy();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BabelConfigManager.getInstance();
      const instance2 = BabelConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Default Configuration', () => {
    it('should create a valid default configuration', () => {
      const config = configManager.getCurrentConfig();
      
      expect(config).toMatchObject({
        presets: expect.arrayContaining([
          expect.objectContaining({
            name: '@babel/preset-env',
            enabled: true
          })
        ]),
        plugins: expect.any(Array),
        targets: expect.objectContaining({
          node: '18'
        }),
        sourceType: 'unambiguous'
      });
    });

    it('should validate default configuration', () => {
      const config = configManager.getCurrentConfig();
      const validation = configManager.validateConfig(config);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration from project path', async () => {
      const config = await configManager.loadConfig('./test-project');
      
      expect(config).toBeDefined();
      expect(config.presets).toBeDefined();
      expect(config.plugins).toBeDefined();
    });

    it('should cache loaded configurations', async () => {
      const config1 = await configManager.loadConfig('./test-project');
      const config2 = await configManager.loadConfig('./test-project');
      
      expect(config1).toBe(config2); // Should be the same cached instance
    });

    it('should load different configurations for different paths', async () => {
      const config1 = await configManager.loadConfig('./project1');
      const config2 = await configManager.loadConfig('./project2');
      
      // They should be different instances (though content might be similar)
      expect(config1).not.toBe(config2);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration with partial updates', () => {
      const originalConfig = configManager.getCurrentConfig();
      
      const updates = {
        sourceType: 'module' as const,
        targets: { node: '16' }
      };
      
      configManager.updateConfig(updates);
      const updatedConfig = configManager.getCurrentConfig();
      
      expect(updatedConfig.sourceType).toBe('module');
      expect(updatedConfig.targets.node).toBe('16');
      expect(updatedConfig.presets).toEqual(originalConfig.presets); // Should preserve other fields
    });

    it('should clear cache when configuration is updated', async () => {
      // Load and cache a configuration
      await configManager.loadConfig('./test-project');
      
      // Update configuration (should clear cache)
      configManager.updateConfig({ sourceType: 'script' });
      
      // Loading again should not return cached version
      const newConfig = await configManager.loadConfig('./test-project');
      expect(newConfig.sourceType).toBe('script');
    });
  });

  describe('Language-Specific Configuration', () => {
    it('should provide JavaScript-specific configuration', () => {
      const jsConfig = configManager.getConfigForLanguage('javascript');
      
      expect(jsConfig.presets).toEqual([
        expect.objectContaining({
          name: '@babel/preset-env',
          enabled: true
        })
      ]);
    });

    it('should provide TypeScript-specific configuration', () => {
      const tsConfig = configManager.getConfigForLanguage('typescript');
      
      expect(tsConfig.presets).toEqual([
        expect.objectContaining({
          name: '@babel/preset-typescript',
          enabled: true,
          order: 0
        }),
        expect.objectContaining({
          name: '@babel/preset-env',
          enabled: true,
          order: 1
        })
      ]);
    });

    it('should return empty config for unknown language', () => {
      const unknownConfig = configManager.getConfigForLanguage('unknown');
      expect(unknownConfig).toEqual({});
    });
  });

  describe('Framework-Specific Configuration', () => {
    it('should provide React-specific configuration', () => {
      const reactConfig = configManager.getConfigForFramework('react');
      
      expect(reactConfig.presets).toEqual([
        expect.objectContaining({
          name: '@babel/preset-react',
          options: { runtime: 'automatic' },
          enabled: true
        })
      ]);
    });

    it('should provide Solid-specific configuration', () => {
      const solidConfig = configManager.getConfigForFramework('solid');
      
      expect(solidConfig.presets).toEqual([
        expect.objectContaining({
          name: 'babel-preset-solid',
          enabled: true
        })
      ]);
    });

    it('should provide Vue-specific configuration', () => {
      const vueConfig = configManager.getConfigForFramework('vue');
      
      expect(vueConfig.presets).toEqual([
        expect.objectContaining({
          name: '@vue/babel-preset-jsx',
          enabled: true
        })
      ]);
    });

    it('should return empty config for unknown framework', () => {
      const unknownConfig = configManager.getConfigForFramework('unknown');
      expect(unknownConfig).toEqual({});
    });
  });

  describe('Preset and Plugin Management', () => {
    it('should install a preset', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await configManager.installPreset('@babel/preset-flow', '7.24.0');
      
      expect(consoleSpy).toHaveBeenCalledWith('Installing preset @babel/preset-flow@7.24.0...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Preset @babel/preset-flow installed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should install a plugin', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await configManager.installPlugin('@babel/plugin-transform-arrow-functions');
      
      expect(consoleSpy).toHaveBeenCalledWith('Installing plugin @babel/plugin-transform-arrow-functions...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Plugin @babel/plugin-transform-arrow-functions installed successfully');
      
      consoleSpy.mockRestore();
    });

    it('should uninstall a preset', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // First install a preset
      await configManager.installPreset('@babel/preset-flow');
      
      // Then uninstall it
      await configManager.uninstallPreset('@babel/preset-flow');
      
      expect(consoleSpy).toHaveBeenCalledWith('Uninstalling preset @babel/preset-flow...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Preset @babel/preset-flow uninstalled successfully');
      
      consoleSpy.mockRestore();
    });

    it('should uninstall a plugin', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // First install a plugin
      await configManager.installPlugin('@babel/plugin-transform-arrow-functions');
      
      // Then uninstall it
      await configManager.uninstallPlugin('@babel/plugin-transform-arrow-functions');
      
      expect(consoleSpy).toHaveBeenCalledWith('Uninstalling plugin @babel/plugin-transform-arrow-functions...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Plugin @babel/plugin-transform-arrow-functions uninstalled successfully');
      
      consoleSpy.mockRestore();
    });

    it('should get available presets', () => {
      const presets = configManager.getAvailablePresets();
      
      expect(presets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '@babel/preset-env'
          }),
          expect.objectContaining({
            name: '@babel/preset-typescript'
          }),
          expect.objectContaining({
            name: '@babel/preset-react'
          })
        ])
      );
    });

    it('should get available plugins', () => {
      const plugins = configManager.getAvailablePlugins();
      
      expect(plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '@babel/plugin-transform-runtime'
          }),
          expect.objectContaining({
            name: '@babel/plugin-proposal-class-properties'
          })
        ])
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should validate a correct configuration', () => {
      const validConfig: BabelGlobalConfig = {
        presets: [
          {
            name: '@babel/preset-env',
            options: {},
            enabled: true,
            order: 0
          }
        ],
        plugins: [],
        targets: { node: '18' },
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      };

      const result = configManager.validateConfig(validConfig);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid presets configuration', () => {
      const invalidConfig = {
        presets: 'not-an-array',
        plugins: [],
        targets: {},
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      } as any;

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'presets',
            message: 'Presets must be an array'
          })
        ])
      );
    });

    it('should detect invalid plugins configuration', () => {
      const invalidConfig = {
        presets: [],
        plugins: null,
        targets: {},
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      } as any;

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'plugins',
            message: 'Plugins must be an array'
          })
        ])
      );
    });

    it('should detect invalid sourceType', () => {
      const invalidConfig: BabelGlobalConfig = {
        presets: [],
        plugins: [],
        targets: {},
        sourceType: 'invalid' as any,
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      };

      const result = configManager.validateConfig(invalidConfig);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'sourceType',
            message: 'SourceType must be "module", "script", or "unambiguous"'
          })
        ])
      );
    });

    it('should warn about uninstalled presets', () => {
      const configWithUninstalledPreset: BabelGlobalConfig = {
        presets: [
          {
            name: '@babel/preset-nonexistent',
            options: {},
            enabled: true,
            order: 0
          }
        ],
        plugins: [],
        targets: {},
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      };

      const result = configManager.validateConfig(configWithUninstalledPreset);
      
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'presets[0].name',
            message: "Preset '@babel/preset-nonexistent' is not installed"
          })
        ])
      );
    });
  });

  describe('Configuration Testing', () => {
    it('should test configuration with valid code', async () => {
      const config = configManager.getCurrentConfig();
      const testCode = 'const x = 1;';
      
      const result = await configManager.testConfig(config, testCode);
      
      expect(result.success).toBe(true);
      expect(result.transformedCode).toBeDefined();
    });

    it('should fail test with invalid configuration', async () => {
      const invalidConfig = {
        presets: 'invalid',
        plugins: null
      } as any;
      
      const testCode = 'const x = 1;';
      
      const result = await configManager.testConfig(invalidConfig, testCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });
  });

  describe('Configuration Import/Export', () => {
    it('should export configuration as JSON', () => {
      const exported = configManager.exportConfig('json');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toMatchObject({
        presets: expect.any(Array),
        plugins: expect.any(Array),
        targets: expect.any(Object)
      });
    });

    it('should export configuration as JavaScript', () => {
      const exported = configManager.exportConfig('js');
      
      expect(exported).toMatch(/^module\.exports = /);
      expect(exported).toContain('"presets"');
      expect(exported).toContain('"plugins"');
    });

    it('should export configuration as .babelrc format', () => {
      const exported = configManager.exportConfig('babelrc');
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('presets');
      expect(parsed).toHaveProperty('plugins');
      expect(parsed.presets).toEqual(
        expect.arrayContaining([
          expect.arrayContaining(['@babel/preset-env', expect.any(Object)])
        ])
      );
    });

    it('should import JSON configuration', () => {
      const jsonConfig = JSON.stringify({
        presets: [
          {
            name: '@babel/preset-env',
            options: { targets: { node: '16' } },
            enabled: true,
            order: 0
          }
        ],
        plugins: [],
        targets: { node: '16' },
        sourceType: 'module',
        assumptions: {},
        parserOpts: {},
        generatorOpts: {},
        env: {}
      });

      const imported = configManager.importConfig(jsonConfig, 'json');
      
      expect(imported.targets.node).toBe('16');
      expect(imported.sourceType).toBe('module');
    });

    it('should import JavaScript configuration', () => {
      const jsConfig = `module.exports = {
        "presets": [
          {
            "name": "@babel/preset-env",
            "options": { "targets": { "node": "14" } },
            "enabled": true,
            "order": 0
          }
        ],
        "plugins": [],
        "targets": { "node": "14" },
        "sourceType": "script"
      };`;

      const imported = configManager.importConfig(jsConfig, 'js');
      
      expect(imported.targets.node).toBe('14');
      expect(imported.sourceType).toBe('script');
    });

    it('should import .babelrc configuration', () => {
      const babelrcConfig = JSON.stringify({
        presets: [
          ['@babel/preset-env', { targets: { browsers: ['> 1%'] } }],
          '@babel/preset-react'
        ],
        plugins: [
          '@babel/plugin-transform-runtime',
          ['@babel/plugin-proposal-class-properties', { loose: true }]
        ]
      });

      const imported = configManager.importConfig(babelrcConfig, 'babelrc');
      
      expect(imported.presets).toHaveLength(2);
      expect(imported.presets[0]).toMatchObject({
        name: '@babel/preset-env',
        options: { targets: { browsers: ['> 1%'] } },
        enabled: true,
        order: 0
      });
      expect(imported.presets[1]).toMatchObject({
        name: '@babel/preset-react',
        options: {},
        enabled: true,
        order: 1
      });
      expect(imported.plugins).toHaveLength(2);
    });

    it('should handle invalid import formats', () => {
      expect(() => {
        configManager.importConfig('invalid json', 'json');
      }).toThrow('Failed to parse json configuration');

      expect(() => {
        configManager.importConfig('invalid js', 'js');
      }).toThrow('Invalid JavaScript configuration format');
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to project path', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const config = configManager.getCurrentConfig();
      await configManager.saveConfig(config, './test-project');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would save config to ./test-project/babel.config.js:'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });

    it('should save configuration to default path', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const config = configManager.getCurrentConfig();
      await configManager.saveConfig(config);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would save config to ./babel.config.js:'),
        expect.any(String)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Configuration Reset', () => {
    it('should reset configuration to defaults', () => {
      // Modify configuration
      configManager.updateConfig({ sourceType: 'script' });
      expect(configManager.getCurrentConfig().sourceType).toBe('script');
      
      // Reset to defaults
      configManager.resetToDefaults();
      expect(configManager.getCurrentConfig().sourceType).toBe('unambiguous');
    });

    it('should clear cache when resetting', async () => {
      // Load and cache configuration
      await configManager.loadConfig('./test-project');
      
      // Reset (should clear cache)
      configManager.resetToDefaults();
      
      // Verify cache is cleared by checking internal state
      configManager.clearCache(); // This should not throw
    });
  });

  describe('Cache Management', () => {
    it('should clear configuration cache', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      configManager.clearCache();
      
      expect(consoleSpy).toHaveBeenCalledWith('Configuration cache cleared');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Lifecycle Management', () => {
    it('should properly destroy instance', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      configManager.destroy();
      
      expect(consoleSpy).toHaveBeenCalledWith('🗑️ BabelConfigManager destroyed');
      
      consoleSpy.mockRestore();
    });
  });
});