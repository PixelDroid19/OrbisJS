import type { LanguageType } from '../../core/editor';
import type { 
  ToolbarConfig, 
  ToolbarCustomization, 
  ToolbarConfigManager,
  ToolbarContextFilter 
} from '../types/toolbar';
import type { ToolbarContext, ToolbarItem } from '../components/FloatingToolbar';
import { contextMatcher } from '../utils/contextMatcher';

const STORAGE_KEYS = {
  CONFIGS: 'orbisjs-toolbar-configs',
  CUSTOMIZATIONS: 'orbisjs-toolbar-customizations',
  ACTIVE_CONFIG: 'orbisjs-active-toolbar-config'
};

// Default toolbar configurations for each file type
const DEFAULT_CONFIGS: ToolbarConfig[] = [
  {
    id: 'javascript-default',
    name: 'JavaScript Default',
    context: { fileType: 'javascript' },
    position: 'top-right',
    autoHide: false,
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [
      {
        id: 'format',
        icon: '⚡',
        label: 'Format Code',
        action: () => console.log('Format JS'),
        shortcut: 'Ctrl+Shift+F',
        visible: true,
        group: 'formatting',
        tooltip: 'Format JavaScript code'
      },
      {
        id: 'run',
        icon: '▶️',
        label: 'Run Code',
        action: () => console.log('Run JS'),
        shortcut: 'Ctrl+Enter',
        visible: true,
        group: 'execution',
        tooltip: 'Execute JavaScript code'
      },
      {
        id: 'lint',
        icon: '🔍',
        label: 'Lint Code',
        action: () => console.log('Lint JS'),
        visible: true,
        group: 'analysis',
        tooltip: 'Check code for issues'
      }
    ]
  },
  {
    id: 'typescript-default',
    name: 'TypeScript Default',
    context: { fileType: 'typescript' },
    position: 'top-right',
    autoHide: false,
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [
      {
        id: 'format',
        icon: '⚡',
        label: 'Format Code',
        action: () => console.log('Format TS'),
        shortcut: 'Ctrl+Shift+F',
        visible: true,
        group: 'formatting',
        tooltip: 'Format TypeScript code'
      },
      {
        id: 'compile',
        icon: '🔨',
        label: 'Compile',
        action: () => console.log('Compile TS'),
        shortcut: 'Ctrl+B',
        visible: true,
        group: 'compilation',
        tooltip: 'Compile TypeScript to JavaScript'
      },
      {
        id: 'run',
        icon: '▶️',
        label: 'Run Code',
        action: () => console.log('Run TS'),
        shortcut: 'Ctrl+Enter',
        visible: true,
        group: 'execution',
        tooltip: 'Execute TypeScript code'
      },
      {
        id: 'types',
        icon: '📋',
        label: 'Check Types',
        action: () => console.log('Check Types'),
        visible: true,
        group: 'analysis',
        tooltip: 'Perform type checking'
      }
    ]
  },
  {
    id: 'json-default',
    name: 'JSON Default',
    context: { fileType: 'json' },
    position: 'top-right',
    autoHide: false,
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [
      {
        id: 'format',
        icon: '⚡',
        label: 'Format JSON',
        action: () => console.log('Format JSON'),
        shortcut: 'Ctrl+Shift+F',
        visible: true,
        group: 'formatting',
        tooltip: 'Format JSON structure'
      },
      {
        id: 'validate',
        icon: '✅',
        label: 'Validate',
        action: () => console.log('Validate JSON'),
        visible: true,
        group: 'validation',
        tooltip: 'Validate JSON syntax'
      }
    ]
  },
  {
    id: 'css-default',
    name: 'CSS Default',
    context: { fileType: 'css' },
    position: 'top-right',
    autoHide: false,
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [
      {
        id: 'format',
        icon: '⚡',
        label: 'Format CSS',
        action: () => console.log('Format CSS'),
        shortcut: 'Ctrl+Shift+F',
        visible: true,
        group: 'formatting',
        tooltip: 'Format CSS code'
      },
      {
        id: 'minify',
        icon: '📦',
        label: 'Minify',
        action: () => console.log('Minify CSS'),
        visible: true,
        group: 'optimization',
        tooltip: 'Minify CSS for production'
      },
      {
        id: 'lint',
        icon: '🔍',
        label: 'Lint CSS',
        action: () => console.log('Lint CSS'),
        visible: true,
        group: 'analysis',
        tooltip: 'Check CSS for issues'
      }
    ]
  },
  {
    id: 'html-default',
    name: 'HTML Default',
    context: { fileType: 'html' },
    position: 'top-right',
    autoHide: false,
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tools: [
      {
        id: 'format',
        icon: '⚡',
        label: 'Format HTML',
        action: () => console.log('Format HTML'),
        shortcut: 'Ctrl+Shift+F',
        visible: true,
        group: 'formatting',
        tooltip: 'Format HTML structure'
      },
      {
        id: 'validate',
        icon: '✅',
        label: 'Validate',
        action: () => console.log('Validate HTML'),
        visible: true,
        group: 'validation',
        tooltip: 'Validate HTML markup'
      },
      {
        id: 'preview',
        icon: '👁️',
        label: 'Preview',
        action: () => console.log('Preview HTML'),
        shortcut: 'Ctrl+Shift+P',
        visible: true,
        group: 'preview',
        tooltip: 'Preview HTML in browser'
      }
    ]
  }
];

export class ToolbarConfigManagerImpl implements ToolbarConfigManager {
  private configs: ToolbarConfig[] = [];
  private customizations: ToolbarCustomization[] = [];
  private activeConfigId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load configurations and customizations from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load configurations
      const storedConfigs = localStorage.getItem(STORAGE_KEYS.CONFIGS);
      if (storedConfigs) {
        this.configs = JSON.parse(storedConfigs);
      } else {
        // Initialize with default configurations
        this.configs = [...DEFAULT_CONFIGS];
        this.saveConfigsToStorage();
      }

      // Load customizations
      const storedCustomizations = localStorage.getItem(STORAGE_KEYS.CUSTOMIZATIONS);
      if (storedCustomizations) {
        this.customizations = JSON.parse(storedCustomizations);
      }

      // Load active config ID
      this.activeConfigId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CONFIG);
    } catch (error) {
      console.warn('Failed to load toolbar configurations from localStorage:', error);
      this.configs = [...DEFAULT_CONFIGS];
    }
  }

  /**
   * Save configurations to localStorage
   */
  private saveConfigsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIGS, JSON.stringify(this.configs));
    } catch (error) {
      console.warn('Failed to save toolbar configurations to localStorage:', error);
    }
  }

  /**
   * Save customizations to localStorage
   */
  private saveCustomizationsToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMIZATIONS, JSON.stringify(this.customizations));
    } catch (error) {
      console.warn('Failed to save toolbar customizations to localStorage:', error);
    }
  }

  /**
   * Apply customizations to a configuration
   */
  private applyCustomizations(config: ToolbarConfig): ToolbarConfig {
    const relevantCustomizations = this.customizations.filter(
      customization => customization.configId === config.id
    );

    if (relevantCustomizations.length === 0) {
      return config;
    }

    // Create a copy of the config to avoid mutation
    const customizedConfig: ToolbarConfig = {
      ...config,
      tools: [...config.tools]
    };

    // Apply each customization
    for (const customization of relevantCustomizations) {
      // Apply position override
      if (customization.positionOverride) {
        customizedConfig.position = customization.positionOverride;
      }

      // Apply auto-hide override
      if (customization.autoHideOverride !== undefined) {
        customizedConfig.autoHide = customization.autoHideOverride;
      }

      // Apply tool overrides
      for (const toolOverride of customization.toolOverrides) {
        const toolIndex = customizedConfig.tools.findIndex(tool => tool.id === toolOverride.id);
        if (toolIndex !== -1) {
          const tool = customizedConfig.tools[toolIndex];
          
          // Apply overrides
          if (toolOverride.visible !== undefined) {
            tool.visible = toolOverride.visible;
          }
          if (toolOverride.disabled !== undefined) {
            tool.disabled = toolOverride.disabled;
          }
          if (toolOverride.group !== undefined) {
            tool.group = toolOverride.group;
          }
          if (toolOverride.customIcon) {
            tool.icon = toolOverride.customIcon;
          }
          if (toolOverride.customLabel) {
            tool.label = toolOverride.customLabel;
          }
          if (toolOverride.customShortcut) {
            tool.shortcut = toolOverride.customShortcut;
          }
        }
      }

      // Apply tool ordering
      const toolsWithOrder = customization.toolOverrides
        .filter(override => override.order !== undefined)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (toolsWithOrder.length > 0) {
        const reorderedTools = [...customizedConfig.tools];
        
        // Sort tools based on custom order
        for (const toolOverride of toolsWithOrder) {
          const toolIndex = reorderedTools.findIndex(tool => tool.id === toolOverride.id);
          if (toolIndex !== -1 && toolOverride.order !== undefined) {
            const tool = reorderedTools.splice(toolIndex, 1)[0];
            reorderedTools.splice(toolOverride.order, 0, tool);
          }
        }
        
        customizedConfig.tools = reorderedTools;
      }
    }

    return customizedConfig;
  }

  /**
   * Get the best matching configuration for a given context
   */
  getConfigForContext(context: ToolbarContext): ToolbarConfig | null {
    const matchingConfigs = this.configs.filter(config => 
      contextMatcher.matches(context, config.context)
    );

    if (matchingConfigs.length === 0) {
      return null;
    }

    // Find the best match based on specificity
    const bestMatch = contextMatcher.findBestMatch(context, matchingConfigs);
    
    if (!bestMatch) {
      return null;
    }

    // Apply any customizations
    return this.applyCustomizations(bestMatch);
  }

  /**
   * Save a toolbar configuration
   */
  async saveConfig(config: ToolbarConfig): Promise<void> {
    const existingIndex = this.configs.findIndex(c => c.id === config.id);
    
    const configToSave = {
      ...config,
      updatedAt: Date.now()
    };

    if (existingIndex !== -1) {
      this.configs[existingIndex] = configToSave;
    } else {
      this.configs.push(configToSave);
    }

    this.saveConfigsToStorage();
  }

  /**
   * Delete a toolbar configuration
   */
  async deleteConfig(configId: string): Promise<void> {
    // Don't allow deletion of default configurations
    const config = this.configs.find(c => c.id === configId);
    if (config?.isDefault) {
      throw new Error('Cannot delete default configuration');
    }

    this.configs = this.configs.filter(c => c.id !== configId);
    
    // Also remove related customizations
    this.customizations = this.customizations.filter(c => c.configId !== configId);
    
    this.saveConfigsToStorage();
    this.saveCustomizationsToStorage();
  }

  /**
   * Get customizations for a specific configuration
   */
  getCustomizations(configId: string): ToolbarCustomization[] {
    return this.customizations.filter(c => c.configId === configId);
  }

  /**
   * Save a toolbar customization
   */
  async saveCustomization(customization: ToolbarCustomization): Promise<void> {
    const existingIndex = this.customizations.findIndex(
      c => c.configId === customization.configId && 
           JSON.stringify(c.contextFilter) === JSON.stringify(customization.contextFilter)
    );

    const customizationToSave = {
      ...customization,
      updatedAt: Date.now()
    };

    if (existingIndex !== -1) {
      this.customizations[existingIndex] = customizationToSave;
    } else {
      this.customizations.push(customizationToSave);
    }

    this.saveCustomizationsToStorage();
  }

  /**
   * Delete a toolbar customization
   */
  async deleteCustomization(customizationId: string): Promise<void> {
    this.customizations = this.customizations.filter(c => 
      `${c.configId}-${JSON.stringify(c.contextFilter)}` !== customizationId
    );
    this.saveCustomizationsToStorage();
  }

  /**
   * Reset all configurations to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.configs = [...DEFAULT_CONFIGS];
    this.customizations = [];
    this.activeConfigId = null;

    this.saveConfigsToStorage();
    this.saveCustomizationsToStorage();
    
    try {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONFIG);
    } catch (error) {
      console.warn('Failed to reset active config:', error);
    }
  }

  /**
   * Export configurations as JSON string
   */
  exportConfigs(): string {
    return JSON.stringify({
      configs: this.configs,
      customizations: this.customizations,
      activeConfigId: this.activeConfigId,
      exportedAt: Date.now(),
      version: '1.0.0'
    }, null, 2);
  }

  /**
   * Import configurations from JSON string
   */
  async importConfigs(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data);
      
      if (!imported.configs || !Array.isArray(imported.configs)) {
        throw new Error('Invalid configuration data: missing configs array');
      }

      // Validate configuration structure
      for (const config of imported.configs) {
        if (!config.id || !config.name || !config.context || !config.tools) {
          throw new Error('Invalid configuration structure');
        }
      }

      // Merge with existing configurations (don't overwrite defaults)
      const nonDefaultConfigs = imported.configs.filter((config: ToolbarConfig) => !config.isDefault);
      const existingNonDefaults = this.configs.filter(config => !config.isDefault);
      
      // Remove existing non-default configs and add imported ones
      this.configs = [
        ...this.configs.filter(config => config.isDefault),
        ...nonDefaultConfigs
      ];

      // Import customizations if present
      if (imported.customizations && Array.isArray(imported.customizations)) {
        this.customizations = imported.customizations;
      }

      this.saveConfigsToStorage();
      this.saveCustomizationsToStorage();
    } catch (error) {
      throw new Error(`Failed to import configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all configurations
   */
  getAllConfigs(): ToolbarConfig[] {
    return [...this.configs];
  }

  /**
   * Get all customizations
   */
  getAllCustomizations(): ToolbarCustomization[] {
    return [...this.customizations];
  }

  /**
   * Set active configuration
   */
  setActiveConfig(configId: string | null): void {
    this.activeConfigId = configId;
    try {
      if (configId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CONFIG, configId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONFIG);
      }
    } catch (error) {
      console.warn('Failed to save active config:', error);
    }
  }

  /**
   * Get active configuration ID
   */
  getActiveConfigId(): string | null {
    return this.activeConfigId;
  }
}

// Export singleton instance
export const toolbarConfigManager = new ToolbarConfigManagerImpl();