/**
 * Unit tests for Modern Babel Configuration System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BabelConfigTemplates, BabelDependencies, type ProjectType } from '../ModernBabelConfig.js';

describe('BabelConfigTemplates', () => {
  describe('getJavaScriptTemplate', () => {
    it('should return valid JavaScript configuration', () => {
      const config = BabelConfigTemplates.getJavaScriptTemplate();
      
      expect(config).toBeDefined();
      expect(config.presets).toHaveLength(1);
      expect(config.presets[0].name).toBe('@babel/preset-env');
      expect(config.plugins.length).toBeGreaterThan(0);
      expect(config.sourceType).toBe('module');
      expect(config.targets.node).toBe('18');
    });

    it('should include essential plugins', () => {
      const config = BabelConfigTemplates.getJavaScriptTemplate();
      
      const pluginNames = config.plugins.map(p => p.name);
      expect(pluginNames).toContain('@babel/plugin-transform-runtime');
      expect(pluginNames).toContain('@babel/plugin-transform-optional-chaining');
      expect(pluginNames).toContain('@babel/plugin-transform-nullish-coalescing-operator');
    });

    it('should have proper plugin ordering', () => {
      const config = BabelConfigTemplates.getJavaScriptTemplate();
      
      const orders = config.plugins.map(p => p.order);
      const sortedOrders = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sortedOrders);
    });
  });

  describe('getTypeScriptTemplate', () => {
    it('should return valid TypeScript configuration', () => {
      const config = BabelConfigTemplates.getTypeScriptTemplate();
      
      expect(config).toBeDefined();
      expect(config.presets.length).toBeGreaterThan(1);
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain('@babel/preset-typescript');
      expect(presetNames).toContain('@babel/preset-env');
    });

    it('should include TypeScript-specific plugins', () => {
      const config = BabelConfigTemplates.getTypeScriptTemplate();
      
      const pluginNames = config.plugins.map(p => p.name);
      expect(pluginNames).toContain('@babel/plugin-proposal-decorators');
      expect(pluginNames).toContain('@babel/plugin-proposal-class-properties');
    });

    it('should have TypeScript preset first', () => {
      const config = BabelConfigTemplates.getTypeScriptTemplate();
      
      const tsPreset = config.presets.find(p => p.name === '@babel/preset-typescript');
      expect(tsPreset?.order).toBe(0);
    });
  });

  describe('getReactTemplate', () => {
    it('should return valid React configuration', () => {
      const config = BabelConfigTemplates.getReactTemplate();
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain('@babel/preset-react');
      expect(presetNames).toContain('@babel/preset-typescript');
      expect(presetNames).toContain('@babel/preset-env');
    });

    it('should configure React preset with automatic runtime', () => {
      const config = BabelConfigTemplates.getReactTemplate();
      
      const reactPreset = config.presets.find(p => p.name === '@babel/preset-react');
      expect(reactPreset?.options?.runtime).toBe('automatic');
      expect(reactPreset?.options?.development).toBe(true);
    });

    it('should include React development plugin', () => {
      const config = BabelConfigTemplates.getReactTemplate();
      
      const pluginNames = config.plugins.map(p => p.name);
      expect(pluginNames).toContain('@babel/plugin-transform-react-jsx-development');
    });
  });

  describe('getSolidTemplate', () => {
    it('should return valid Solid configuration', () => {
      const config = BabelConfigTemplates.getSolidTemplate();
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain('solid');
      expect(presetNames).toContain('@babel/preset-typescript');
    });

    it('should configure Solid preset for DOM generation', () => {
      const config = BabelConfigTemplates.getSolidTemplate();
      
      const solidPreset = config.presets.find(p => p.name === 'solid');
      expect(solidPreset?.options?.generate).toBe('dom');
      expect(solidPreset?.options?.dev).toBe(true);
    });
  });

  describe('getVueTemplate', () => {
    it('should return valid Vue configuration', () => {
      const config = BabelConfigTemplates.getVueTemplate();
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain('@vue/babel-preset-jsx');
      expect(presetNames).toContain('@babel/preset-typescript');
    });

    it('should configure Vue preset for Composition API', () => {
      const config = BabelConfigTemplates.getVueTemplate();
      
      const vuePreset = config.presets.find(p => p.name === '@vue/babel-preset-jsx');
      expect(vuePreset?.options?.compositionAPI).toBe(true);
    });
  });

  describe('getNodeTemplate', () => {
    it('should return valid Node.js configuration', () => {
      const config = BabelConfigTemplates.getNodeTemplate();
      
      expect(config.targets.node).toBe('18');
      
      const envPreset = config.presets.find(p => p.name === '@babel/preset-env');
      expect(envPreset?.options?.modules).toBe('commonjs');
    });
  });

  describe('getTemplate', () => {
    const testCases: Array<[ProjectType, string]> = [
      ['javascript', '@babel/preset-env'],
      ['typescript', '@babel/preset-typescript'],
      ['react', '@babel/preset-react'],
      ['solid', 'solid'],
      ['vue', '@vue/babel-preset-jsx'],
      ['node', '@babel/preset-env']
    ];

    it.each(testCases)('should return correct template for %s project', (projectType, expectedPreset) => {
      const config = BabelConfigTemplates.getTemplate(projectType);
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain(expectedPreset);
    });

    it('should return JavaScript template for unknown project type', () => {
      // @ts-expect-error - Testing invalid input
      const config = BabelConfigTemplates.getTemplate('unknown');
      
      const presetNames = config.presets.map(p => p.name);
      expect(presetNames).toContain('@babel/preset-env');
    });
  });
});

describe('BabelDependencies', () => {
  describe('getCoreDependencies', () => {
    it('should return core Babel runtime dependencies', () => {
      const deps = BabelDependencies.getCoreDependencies();
      
      expect(deps).toHaveProperty('@babel/runtime');
      expect(deps['@babel/runtime']).toMatch(/^\^7\./);
    });
  });

  describe('getCoreDevDependencies', () => {
    it('should return core Babel development dependencies', () => {
      const deps = BabelDependencies.getCoreDevDependencies();
      
      const expectedDeps = [
        '@babel/preset-env',
        '@babel/preset-typescript',
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-optional-chaining',
        '@babel/plugin-transform-nullish-coalescing-operator',
        '@babel/plugin-proposal-decorators',
        '@babel/plugin-proposal-class-properties'
      ];

      expectedDeps.forEach(dep => {
        expect(deps).toHaveProperty(dep);
        expect(deps[dep]).toMatch(/^\^7\./);
      });
    });
  });

  describe('getReactDependencies', () => {
    it('should return React-specific dependencies', () => {
      const deps = BabelDependencies.getReactDependencies();
      
      expect(deps).toHaveProperty('@babel/preset-react');
      expect(deps).toHaveProperty('@babel/plugin-transform-react-jsx-development');
    });
  });

  describe('getSolidDependencies', () => {
    it('should return Solid-specific dependencies', () => {
      const deps = BabelDependencies.getSolidDependencies();
      
      expect(deps).toHaveProperty('babel-preset-solid');
      expect(deps['babel-preset-solid']).toMatch(/^\^1\./);
    });
  });

  describe('getVueDependencies', () => {
    it('should return Vue-specific dependencies', () => {
      const deps = BabelDependencies.getVueDependencies();
      
      expect(deps).toHaveProperty('@vue/babel-preset-jsx');
      expect(deps['@vue/babel-preset-jsx']).toMatch(/^\^1\./);
    });
  });

  describe('getDependenciesForType', () => {
    it('should return correct dependencies for JavaScript project', () => {
      const { dependencies, devDependencies } = BabelDependencies.getDependenciesForType('javascript');
      
      expect(dependencies).toHaveProperty('@babel/runtime');
      expect(devDependencies).toHaveProperty('@babel/core');
      expect(devDependencies).toHaveProperty('@babel/preset-env');
      expect(devDependencies).not.toHaveProperty('@babel/preset-react');
    });

    it('should return correct dependencies for React project', () => {
      const { dependencies, devDependencies } = BabelDependencies.getDependenciesForType('react');
      
      expect(dependencies).toHaveProperty('@babel/runtime');
      expect(devDependencies).toHaveProperty('@babel/core');
      expect(devDependencies).toHaveProperty('@babel/preset-env');
      expect(devDependencies).toHaveProperty('@babel/preset-react');
      expect(devDependencies).toHaveProperty('@babel/plugin-transform-react-jsx-development');
    });

    it('should return correct dependencies for Solid project', () => {
      const { dependencies, devDependencies } = BabelDependencies.getDependenciesForType('solid');
      
      expect(devDependencies).toHaveProperty('babel-preset-solid');
      expect(devDependencies).not.toHaveProperty('@babel/preset-react');
    });

    it('should return correct dependencies for Vue project', () => {
      const { dependencies, devDependencies } = BabelDependencies.getDependenciesForType('vue');
      
      expect(devDependencies).toHaveProperty('@vue/babel-preset-jsx');
      expect(devDependencies).not.toHaveProperty('@babel/preset-react');
    });
  });

  describe('getAllDependencies', () => {
    it('should return all available dependencies', () => {
      const { dependencies, devDependencies } = BabelDependencies.getAllDependencies();
      
      // Should include core dependencies
      expect(dependencies).toHaveProperty('@babel/runtime');
      
      // Should include all framework dependencies
      expect(devDependencies).toHaveProperty('@babel/preset-react');
      expect(devDependencies).toHaveProperty('babel-preset-solid');
      expect(devDependencies).toHaveProperty('@vue/babel-preset-jsx');
    });

    it('should not have duplicate dependencies', () => {
      const { dependencies, devDependencies } = BabelDependencies.getAllDependencies();
      
      const allDeps = { ...dependencies, ...devDependencies };
      const depNames = Object.keys(allDeps);
      const uniqueDepNames = [...new Set(depNames)];
      
      expect(depNames).toHaveLength(uniqueDepNames.length);
    });
  });
});

describe('Configuration Validation', () => {
  it('should generate valid configurations for all project types', () => {
    const projectTypes: ProjectType[] = ['javascript', 'typescript', 'react', 'solid', 'vue', 'node'];
    
    projectTypes.forEach(type => {
      const config = BabelConfigTemplates.getTemplate(type);
      
      // Basic structure validation
      expect(config).toHaveProperty('presets');
      expect(config).toHaveProperty('plugins');
      expect(config).toHaveProperty('targets');
      expect(config).toHaveProperty('sourceType');
      
      // Presets should be non-empty and properly structured
      expect(config.presets.length).toBeGreaterThan(0);
      config.presets.forEach(preset => {
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('enabled');
        expect(preset).toHaveProperty('order');
        expect(typeof preset.name).toBe('string');
        expect(typeof preset.enabled).toBe('boolean');
        expect(typeof preset.order).toBe('number');
      });
      
      // Plugins should be properly structured
      config.plugins.forEach(plugin => {
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('enabled');
        expect(plugin).toHaveProperty('order');
        expect(typeof plugin.name).toBe('string');
        expect(typeof plugin.enabled).toBe('boolean');
        expect(typeof plugin.order).toBe('number');
      });
      
      // Source type should be valid
      expect(['module', 'script', 'unambiguous']).toContain(config.sourceType);
    });
  });

  it('should have consistent dependency versions', () => {
    const allDeps = BabelDependencies.getAllDependencies();
    const allVersions = { ...allDeps.dependencies, ...allDeps.devDependencies };
    
    // All Babel packages should use the same major version
    const babelPackages = Object.keys(allVersions).filter(name => name.startsWith('@babel/'));
    const babelVersions = babelPackages.map(name => allVersions[name]);
    
    // All should start with ^7.
    babelVersions.forEach(version => {
      expect(version).toMatch(/^\^7\./);
    });
  });
});