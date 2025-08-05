/**
 * Modern Babel Configuration System
 * Manages Babel presets, plugins, and configurations for different project types
 */

export interface BabelGlobalConfig {
  presets: PresetConfig[];
  plugins: PluginConfig[];
  targets: TargetConfig;
  sourceType: 'module' | 'script' | 'unambiguous';
  assumptions: Record<string, boolean>;
  parserOpts: ParserOptions;
  generatorOpts: GeneratorOptions;
  env: Record<string, Partial<BabelGlobalConfig>>;
}

export interface PresetConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface PluginConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface TargetConfig {
  browsers?: string[];
  node?: string;
  esmodules?: boolean;
  custom?: Record<string, string>;
}

export interface ParserOptions {
  strictMode?: boolean;
  allowImportExportEverywhere?: boolean;
  allowReturnOutsideFunction?: boolean;
  ranges?: boolean;
  tokens?: boolean;
}

export interface GeneratorOptions {
  compact?: boolean;
  minified?: boolean;
  comments?: boolean;
  retainLines?: boolean;
}

export type SupportedFramework = 'react' | 'solid' | 'vue' | 'svelte' | 'none';
export type ProjectType = 'javascript' | 'typescript' | 'react' | 'solid' | 'vue' | 'node';

/**
 * Configuration templates for different project types
 */
export class BabelConfigTemplates {
  /**
   * Get default JavaScript configuration
   */
  static getJavaScriptTemplate(): BabelGlobalConfig {
    return {
      presets: [
        {
          name: '@babel/preset-env',
          options: {
            targets: { node: '18' },
            modules: 'auto'
          }
        }
      ],
      plugins: [
        { name: '@babel/plugin-transform-runtime' }
      ],
      targets: { node: '18' },
      sourceType: 'module',
      assumptions: {},
      parserOpts: {},
      generatorOpts: { comments: true },
      env: {}
    };
  }

  /**
   * Get TypeScript configuration
   */
  static getTypeScriptTemplate(): BabelGlobalConfig {
    const jsConfig = this.getJavaScriptTemplate();
    return {
      ...jsConfig,
      presets: [
        { name: '@babel/preset-typescript' },
        ...jsConfig.presets
      ],
      plugins: [
        { name: '@babel/plugin-proposal-decorators', options: { version: '2023-05' } },
        { name: '@babel/plugin-proposal-class-properties' },
        ...jsConfig.plugins
      ]
    };
  }

  /**
   * Get React configuration
   */
  static getReactTemplate(): BabelGlobalConfig {
    const tsConfig = this.getTypeScriptTemplate();
    return {
      ...tsConfig,
      presets: [
        { name: '@babel/preset-react', options: { runtime: 'automatic' } },
        ...tsConfig.presets
      ]
    };
  }

  /**
   * Get Solid.js configuration
   */
  static getSolidTemplate(): BabelGlobalConfig {
    const tsConfig = this.getTypeScriptTemplate();
    return {
      ...tsConfig,
      presets: [
        { name: 'babel-preset-solid' },
        ...tsConfig.presets
      ]
    };
  }

  /**
   * Get Vue configuration
   */
  static getVueTemplate(): BabelGlobalConfig {
    const tsConfig = this.getTypeScriptTemplate();
    return {
      ...tsConfig,
      presets: [
        { name: '@vue/babel-preset-jsx' },
        ...tsConfig.presets
      ]
    };
  }

  /**
   * Get Node.js optimized configuration
   */
  static getNodeTemplate(): BabelGlobalConfig {
    const jsConfig = this.getJavaScriptTemplate();
    return {
      ...jsConfig,
      presets: [
        {
          name: '@babel/preset-env',
          options: {
            targets: { node: '18' },
            modules: 'commonjs'
          }
        }
      ]
    };
  }

  /**
   * Get configuration template by project type
   */
  static getTemplate(type: ProjectType): BabelGlobalConfig {
    switch (type) {
      case 'javascript':
        return this.getJavaScriptTemplate();
      case 'typescript':
        return this.getTypeScriptTemplate();
      case 'react':
        return this.getReactTemplate();
      case 'solid':
        return this.getSolidTemplate();
      case 'vue':
        return this.getVueTemplate();
      case 'node':
        return this.getNodeTemplate();
      default:
        return this.getJavaScriptTemplate();
    }
  }
}

/**
 * Babel dependency definitions for WebContainer package.json
 */
export class BabelDependencies {
  private static readonly BABEL_VERSION = '^7.24.0';
  
  /**
   * Get dependencies for specific project type
   */
  static getDependenciesForType(type: ProjectType): {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } {
    const dependencies = {
      '@babel/runtime': this.BABEL_VERSION
    };

    const devDependencies = {
      '@babel/core': this.BABEL_VERSION,
      '@babel/preset-env': this.BABEL_VERSION,
      '@babel/plugin-transform-runtime': this.BABEL_VERSION
    };

    // Add type-specific dependencies
    switch (type) {
      case 'typescript':
      case 'react':
      case 'solid':
      case 'vue':
        devDependencies['@babel/preset-typescript'] = this.BABEL_VERSION;
        devDependencies['@babel/plugin-proposal-decorators'] = this.BABEL_VERSION;
        devDependencies['@babel/plugin-proposal-class-properties'] = this.BABEL_VERSION;
        break;
    }

    switch (type) {
      case 'react':
        devDependencies['@babel/preset-react'] = this.BABEL_VERSION;
        break;
      case 'solid':
        devDependencies['babel-preset-solid'] = '^1.8.0';
        break;
      case 'vue':
        devDependencies['@vue/babel-preset-jsx'] = '^1.4.0';
        break;
    }

    return { dependencies, devDependencies };
  }
}