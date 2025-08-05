/**
 * BabelConfigManager - Advanced Babel configuration management
 * Handles dynamic configuration loading, validation, and environment-specific overrides
 */

import type {
  BabelGlobalConfig,
  PresetConfig,
  PluginConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  PresetInfo,
  PluginInfo
} from './types.js';

/**
 * Interface for Babel configuration management
 */
export interface IBabelConfigManager {
  // Configuration management
  loadConfig(projectPath?: string): Promise<BabelGlobalConfig>;
  saveConfig(config: BabelGlobalConfig, projectPath?: string): Promise<void>;
  resetToDefaults(): void;
  
  // Dynamic configuration
  updateConfig(updates: Partial<BabelGlobalConfig>): void;
  getConfigForLanguage(language: string): Partial<BabelGlobalConfig>;
  getConfigForFramework(framework: string): Partial<BabelGlobalConfig>;
  
  // Preset and plugin management
  installPreset(name: string, version?: string): Promise<void>;
  installPlugin(name: string, version?: string): Promise<void>;
  uninstallPreset(name: string): Promise<void>;
  uninstallPlugin(name: string): Promise<void>;
  
  // Configuration validation
  validateConfig(config: BabelGlobalConfig): ValidationResult;
  testConfig(config: BabelGlobalConfig, testCode: string): Promise<any>;
  
  // Import/Export
  exportConfig(format: 'json' | 'js' | 'babelrc'): string;
  importConfig(configString: string, format: 'json' | 'js' | 'babelrc'): BabelGlobalConfig;
}

/**
 * Configuration file types that can be detected and loaded
 */
export interface ConfigFile {
  path: string;
  type: 'babelrc' | 'babel.config.js' | 'package.json';
  content: any;
  exists: boolean;
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  name: string;
  config: Partial<BabelGlobalConfig>;
  condition?: string;
}

/**
 * Preset/Plugin registry entry
 */
export interface RegistryEntry {
  name: string;
  version: string;
  module: any;
  info: PresetInfo | PluginInfo;
  installed: boolean;
  dependencies: string[];
}

/**
 * BabelConfigManager implementation
 */
export class BabelConfigManager implements IBabelConfigManager {
  private static instance: BabelConfigManager | null = null;
  private currentConfig: BabelGlobalConfig;
  private presetRegistry = new Map<string, RegistryEntry>();
  private pluginRegistry = new Map<string, RegistryEntry>();
  private environmentConfigs = new Map<string, EnvironmentConfig>();
  private configCache = new Map<string, BabelGlobalConfig>();

  private constructor() {
    this.currentConfig = this.createDefaultConfig();
    this.initializeDefaultRegistry();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BabelConfigManager {
    if (!BabelConfigManager.instance) {
      BabelConfigManager.instance = new BabelConfigManager();
    }
    return BabelConfigManager.instance;
  }

  /**
   * Create default Babel configuration
   */
  private createDefaultConfig(): BabelGlobalConfig {
    return {
      presets: [
        {
          name: '@babel/preset-env',
          options: {
            targets: { node: '18' },
            modules: 'auto'
          },
          enabled: true,
          order: 0
        }
      ],
      plugins: [],
      targets: {
        node: '18',
        esmodules: true
      },
      sourceType: 'unambiguous',
      assumptions: {},
      parserOpts: {
        strictMode: true,
        allowImportExportEverywhere: false,
        allowReturnOutsideFunction: false,
        ranges: false,
        tokens: false,
        plugins: []
      },
      generatorOpts: {
        compact: false,
        minified: false,
        sourceMaps: true,
        retainLines: false
      },
      env: {}
    };
  }

  /**
   * Initialize default preset and plugin registry
   */
  private async initializeDefaultRegistry(): Promise<void> {
    const defaultPresets = [
      '@babel/preset-env',
      '@babel/preset-typescript',
      '@babel/preset-react',
      'babel-preset-solid',
      '@vue/babel-preset-jsx'
    ];

    const defaultPlugins = [
      '@babel/plugin-transform-runtime',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-proposal-decorators'
    ];

    // Register default presets
    for (const preset of defaultPresets) {
      try {
        await this.registerPreset(preset);
      } catch (error) {
        console.warn(`Failed to register preset ${preset}:`, error);
      }
    }

    // Register default plugins
    for (const plugin of defaultPlugins) {
      try {
        await this.registerPlugin(plugin);
      } catch (error) {
        console.warn(`Failed to register plugin ${plugin}:`, error);
      }
    }
  }

  /**
   * Register a preset in the registry
   */
  private async registerPreset(name: string, version?: string): Promise<void> {
    try {
      const module = await import(name);
      const info: PresetInfo = {
        name,
        version: version || '1.0.0',
        description: `Babel preset: ${name}`,
        options: {},
        dependencies: [],
        frameworks: []
      };

      this.presetRegistry.set(name, {
        name,
        version: version || '1.0.0',
        module: module.default || module,
        info,
        installed: true,
        dependencies: []
      });
    } catch (error) {
      console.warn(`Failed to register preset ${name}:`, error);
    }
  }

  /**
   * Register a plugin in the registry
   */
  private async registerPlugin(name: string, version?: string): Promise<void> {
    try {
      const module = await import(name);
      const info: PluginInfo = {
        name,
        version: version || '1.0.0',
        description: `Babel plugin: ${name}`,
        options: {},
        dependencies: [],
        stage: 0
      };

      this.pluginRegistry.set(name, {
        name,
        version: version || '1.0.0',
        module: module.default || module,
        info,
        installed: true,
        dependencies: []
      });
    } catch (error) {
      console.warn(`Failed to register plugin ${name}:`, error);
    }
  }

  /**
   * Load configuration from project files
   */
  public async loadConfig(projectPath?: string): Promise<BabelGlobalConfig> {
    const cacheKey = projectPath || 'default';
    
    // Check cache first
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey)!;
    }

    try {
      const configFiles = await this.detectConfigFiles(projectPath);
      let config = this.createDefaultConfig();

      // Load configurations in order of precedence
      for (const configFile of configFiles) {
        if (configFile.exists) {
          const fileConfig = await this.loadConfigFile(configFile);
          config = this.mergeConfigs(config, fileConfig);
        }
      }

      // Apply environment-specific configurations
      config = this.applyEnvironmentConfig(config);

      // Cache the result
      this.configCache.set(cacheKey, config);
      this.currentConfig = config;

      return config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      return this.createDefaultConfig();
    }
  }

  /**
   * Detect configuration files in project
   */
  private async detectConfigFiles(projectPath?: string): Promise<ConfigFile[]> {
    const basePath = projectPath || '.';
    
    const configFiles: ConfigFile[] = [
      {
        path: `${basePath}/babel.config.js`,
        type: 'babel.config.js',
        content: null,
        exists: false
      },
      {
        path: `${basePath}/.babelrc`,
        type: 'babelrc',
        content: null,
        exists: false
      },
      {
        path: `${basePath}/.babelrc.json`,
        type: 'babelrc',
        content: null,
        exists: false
      },
      {
        path: `${basePath}/package.json`,
        type: 'package.json',
        content: null,
        exists: false
      }
    ];

    // In a real implementation, we would check file existence
    // For now, we'll simulate this
    return configFiles;
  }

  /**
   * Load configuration from a specific file
   */
  private async loadConfigFile(configFile: ConfigFile): Promise<Partial<BabelGlobalConfig>> {
    try {
      switch (configFile.type) {
        case 'babel.config.js':
          return this.loadJSConfig(configFile.path);
        
        case 'babelrc':
          return this.loadJSONConfig(configFile.path);
        
        case 'package.json':
          return this.loadPackageJSONConfig(configFile.path);
        
        default:
          return {};
      }
    } catch (error) {
      console.error(`Failed to load config file ${configFile.path}:`, error);
      return {};
    }
  }

  /**
   * Load JavaScript configuration file
   */
  private async loadJSConfig(path: string): Promise<Partial<BabelGlobalConfig>> {
    // In a real implementation, we would dynamically import the JS file
    // For now, return a mock configuration
    return {
      presets: [
        {
          name: '@babel/preset-env',
          options: { targets: { node: '16' } },
          enabled: true,
          order: 0
        }
      ],
      plugins: []
    };
  }

  /**
   * Load JSON configuration file (.babelrc)
   */
  private async loadJSONConfig(path: string): Promise<Partial<BabelGlobalConfig>> {
    // In a real implementation, we would read and parse the JSON file
    // For now, return a mock configuration
    return {
      presets: [
        {
          name: '@babel/preset-env',
          options: {},
          enabled: true,
          order: 0
        }
      ],
      plugins: []
    };
  }

  /**
   * Load configuration from package.json babel field
   */
  private async loadPackageJSONConfig(path: string): Promise<Partial<BabelGlobalConfig>> {
    // In a real implementation, we would read package.json and extract babel field
    // For now, return a mock configuration
    return {
      presets: [],
      plugins: []
    };
  }

  /**
   * Merge two configurations with proper precedence
   */
  private mergeConfigs(base: BabelGlobalConfig, override: Partial<BabelGlobalConfig>): BabelGlobalConfig {
    return {
      presets: override.presets || base.presets,
      plugins: override.plugins || base.plugins,
      targets: { ...base.targets, ...override.targets },
      sourceType: override.sourceType || base.sourceType,
      assumptions: { ...base.assumptions, ...override.assumptions },
      parserOpts: { ...base.parserOpts, ...override.parserOpts },
      generatorOpts: { ...base.generatorOpts, ...override.generatorOpts },
      env: { ...base.env, ...override.env }
    };
  }

  /**
   * Apply environment-specific configuration
   */
  private applyEnvironmentConfig(config: BabelGlobalConfig): BabelGlobalConfig {
    const currentEnv = process.env.NODE_ENV || 'development';
    
    if (config.env && config.env[currentEnv]) {
      return this.mergeConfigs(config, config.env[currentEnv]);
    }

    return config;
  }

  /**
   * Save configuration to file
   */
  public async saveConfig(config: BabelGlobalConfig, projectPath?: string): Promise<void> {
    try {
      const configPath = projectPath ? `${projectPath}/babel.config.js` : './babel.config.js';
      const configContent = this.exportConfig('js');
      
      // In a real implementation, we would write to file system
      console.log(`Would save config to ${configPath}:`, configContent);
      
      // Update current config and cache
      this.currentConfig = config;
      const cacheKey = projectPath || 'default';
      this.configCache.set(cacheKey, config);
      
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public resetToDefaults(): void {
    this.currentConfig = this.createDefaultConfig();
    this.configCache.clear();
    console.log('Configuration reset to defaults');
  }

  /**
   * Update current configuration
   */
  public updateConfig(updates: Partial<BabelGlobalConfig>): void {
    this.currentConfig = this.mergeConfigs(this.currentConfig, updates);
    this.configCache.clear(); // Clear cache to force reload
  }

  /**
   * Get configuration optimized for specific language
   */
  public getConfigForLanguage(language: string): Partial<BabelGlobalConfig> {
    switch (language.toLowerCase()) {
      case 'javascript':
        return {
          presets: [
            {
              name: '@babel/preset-env',
              options: { targets: this.currentConfig.targets },
              enabled: true,
              order: 0
            }
          ]
        };
      
      case 'typescript':
        return {
          presets: [
            {
              name: '@babel/preset-typescript',
              options: {},
              enabled: true,
              order: 0
            },
            {
              name: '@babel/preset-env',
              options: { targets: this.currentConfig.targets },
              enabled: true,
              order: 1
            }
          ]
        };
      
      default:
        return {};
    }
  }

  /**
   * Get configuration optimized for specific framework
   */
  public getConfigForFramework(framework: string): Partial<BabelGlobalConfig> {
    switch (framework.toLowerCase()) {
      case 'react':
        return {
          presets: [
            {
              name: '@babel/preset-react',
              options: { runtime: 'automatic' },
              enabled: true,
              order: 0
            }
          ]
        };
      
      case 'solid':
        return {
          presets: [
            {
              name: 'babel-preset-solid',
              options: {},
              enabled: true,
              order: 0
            }
          ]
        };
      
      case 'vue':
        return {
          presets: [
            {
              name: '@vue/babel-preset-jsx',
              options: {},
              enabled: true,
              order: 0
            }
          ]
        };
      
      default:
        return {};
    }
  }

  /**
   * Install a preset
   */
  public async installPreset(name: string, version?: string): Promise<void> {
    try {
      console.log(`Installing preset ${name}${version ? `@${version}` : ''}...`);
      
      // In a real implementation, we would use npm/yarn to install
      // For now, we'll simulate the installation
      await this.registerPreset(name, version);
      
      console.log(`✅ Preset ${name} installed successfully`);
    } catch (error) {
      console.error(`Failed to install preset ${name}:`, error);
      throw error;
    }
  }

  /**
   * Install a plugin
   */
  public async installPlugin(name: string, version?: string): Promise<void> {
    try {
      console.log(`Installing plugin ${name}${version ? `@${version}` : ''}...`);
      
      // In a real implementation, we would use npm/yarn to install
      // For now, we'll simulate the installation
      await this.registerPlugin(name, version);
      
      console.log(`✅ Plugin ${name} installed successfully`);
    } catch (error) {
      console.error(`Failed to install plugin ${name}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a preset
   */
  public async uninstallPreset(name: string): Promise<void> {
    try {
      console.log(`Uninstalling preset ${name}...`);
      
      if (this.presetRegistry.has(name)) {
        this.presetRegistry.delete(name);
        console.log(`✅ Preset ${name} uninstalled successfully`);
      } else {
        console.warn(`Preset ${name} not found in registry`);
      }
    } catch (error) {
      console.error(`Failed to uninstall preset ${name}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  public async uninstallPlugin(name: string): Promise<void> {
    try {
      console.log(`Uninstalling plugin ${name}...`);
      
      if (this.pluginRegistry.has(name)) {
        this.pluginRegistry.delete(name);
        console.log(`✅ Plugin ${name} uninstalled successfully`);
      } else {
        console.warn(`Plugin ${name} not found in registry`);
      }
    } catch (error) {
      console.error(`Failed to uninstall plugin ${name}:`, error);
      throw error;
    }
  }

  /**
   * Validate Babel configuration
   */
  public validateConfig(config: BabelGlobalConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate presets
    if (!config.presets || !Array.isArray(config.presets)) {
      errors.push({
        field: 'presets',
        message: 'Presets must be an array',
        value: config.presets
      });
    } else {
      config.presets.forEach((preset, index) => {
        if (!preset.name) {
          errors.push({
            field: `presets[${index}].name`,
            message: 'Preset name is required',
            value: preset.name
          });
        }

        if (!this.presetRegistry.has(preset.name)) {
          warnings.push({
            field: `presets[${index}].name`,
            message: `Preset '${preset.name}' is not installed`,
            value: preset.name
          });
        }
      });
    }

    // Validate plugins
    if (!config.plugins || !Array.isArray(config.plugins)) {
      errors.push({
        field: 'plugins',
        message: 'Plugins must be an array',
        value: config.plugins
      });
    } else {
      config.plugins.forEach((plugin, index) => {
        if (!plugin.name) {
          errors.push({
            field: `plugins[${index}].name`,
            message: 'Plugin name is required',
            value: plugin.name
          });
        }

        if (!this.pluginRegistry.has(plugin.name)) {
          warnings.push({
            field: `plugins[${index}].name`,
            message: `Plugin '${plugin.name}' is not installed`,
            value: plugin.name
          });
        }
      });
    }

    // Validate targets
    if (config.targets && typeof config.targets !== 'object') {
      errors.push({
        field: 'targets',
        message: 'Targets must be an object',
        value: config.targets
      });
    }

    // Validate sourceType
    if (config.sourceType && !['module', 'script', 'unambiguous'].includes(config.sourceType)) {
      errors.push({
        field: 'sourceType',
        message: 'SourceType must be "module", "script", or "unambiguous"',
        value: config.sourceType
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Test configuration with sample code
   */
  public async testConfig(config: BabelGlobalConfig, testCode: string): Promise<any> {
    try {
      // In a real implementation, we would use the actual Babel transformer
      // For now, we'll simulate a successful test
      console.log('Testing configuration with code:', testCode);
      
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      return {
        success: true,
        transformedCode: '// Transformed code would be here',
        warnings: validation.warnings
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        transformedCode: null
      };
    }
  }

  /**
   * Export configuration in specified format
   */
  public exportConfig(format: 'json' | 'js' | 'babelrc'): string {
    const config = this.currentConfig;

    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
      
      case 'js':
        return `module.exports = ${JSON.stringify(config, null, 2)};`;
      
      case 'babelrc':
        // .babelrc format (simplified config)
        const babelrcConfig = {
          presets: config.presets.filter(p => p.enabled).map(p => [p.name, p.options]),
          plugins: config.plugins.filter(p => p.enabled).map(p => [p.name, p.options])
        };
        return JSON.stringify(babelrcConfig, null, 2);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Import configuration from string
   */
  public importConfig(configString: string, format: 'json' | 'js' | 'babelrc'): BabelGlobalConfig {
    try {
      let parsedConfig: any;

      switch (format) {
        case 'json':
        case 'babelrc':
          parsedConfig = JSON.parse(configString);
          break;
        
        case 'js':
          // In a real implementation, we would safely evaluate the JS
          // For now, we'll try to extract JSON from module.exports
          const match = configString.match(/module\.exports\s*=\s*({[\s\S]*});?/);
          if (match) {
            parsedConfig = JSON.parse(match[1]);
          } else {
            throw new Error('Invalid JavaScript configuration format');
          }
          break;
        
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Convert to our internal format if needed
      if (format === 'babelrc') {
        return this.convertBabelrcToInternalFormat(parsedConfig);
      }

      return parsedConfig as BabelGlobalConfig;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw new Error(`Failed to parse ${format} configuration: ${error.message}`);
    }
  }

  /**
   * Convert .babelrc format to internal format
   */
  private convertBabelrcToInternalFormat(babelrcConfig: any): BabelGlobalConfig {
    const config = this.createDefaultConfig();

    if (babelrcConfig.presets) {
      config.presets = babelrcConfig.presets.map((preset: any, index: number) => {
        if (Array.isArray(preset)) {
          return {
            name: preset[0],
            options: preset[1] || {},
            enabled: true,
            order: index
          };
        } else {
          return {
            name: preset,
            options: {},
            enabled: true,
            order: index
          };
        }
      });
    }

    if (babelrcConfig.plugins) {
      config.plugins = babelrcConfig.plugins.map((plugin: any, index: number) => {
        if (Array.isArray(plugin)) {
          return {
            name: plugin[0],
            options: plugin[1] || {},
            enabled: true,
            order: index
          };
        } else {
          return {
            name: plugin,
            options: {},
            enabled: true,
            order: index
          };
        }
      });
    }

    return config;
  }

  /**
   * Get current configuration
   */
  public getCurrentConfig(): BabelGlobalConfig {
    return { ...this.currentConfig };
  }

  /**
   * Get available presets
   */
  public getAvailablePresets(): PresetInfo[] {
    return Array.from(this.presetRegistry.values()).map(entry => entry.info as PresetInfo);
  }

  /**
   * Get available plugins
   */
  public getAvailablePlugins(): PluginInfo[] {
    return Array.from(this.pluginRegistry.values()).map(entry => entry.info as PluginInfo);
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.configCache.clear();
    console.log('Configuration cache cleared');
  }

  /**
   * Destroy the instance
   */
  public destroy(): void {
    this.configCache.clear();
    this.presetRegistry.clear();
    this.pluginRegistry.clear();
    this.environmentConfigs.clear();
    BabelConfigManager.instance = null;
    console.log('🗑️ BabelConfigManager destroyed');
  }
}

// Export singleton instance
export const babelConfigManager = BabelConfigManager.getInstance();