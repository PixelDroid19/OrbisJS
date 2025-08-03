import { useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  ToolbarConfig, 
  ToolbarCustomization, 
  DragDropState,
  ToolbarConfigurationState 
} from '../types/toolbar';
import type { ToolbarContext, ToolbarItem } from '../components/FloatingToolbar';
import { toolbarConfigManager } from '../services/ToolbarConfigManager';
import { contextMatcher } from '../utils/contextMatcher';

const initialDragDropState: DragDropState = {
  isDragging: false,
  draggedItemId: null,
  dragOverItemId: null,
  dragStartPosition: null
};

export const useToolbarCustomization = (context: ToolbarContext) => {
  const [state, setState] = useState<ToolbarConfigurationState>({
    configs: [],
    customizations: [],
    activeConfigId: null,
    isCustomizing: false,
    dragDropState: initialDragDropState
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const configs = toolbarConfigManager.getAllConfigs();
        const customizations = toolbarConfigManager.getAllCustomizations();
        const activeConfigId = toolbarConfigManager.getActiveConfigId();

        setState(prev => ({
          ...prev,
          configs,
          customizations,
          activeConfigId
        }));
      } catch (error) {
        console.warn('Failed to load toolbar configuration data:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // Get the current configuration for the context
  const currentConfig = useMemo(() => {
    return toolbarConfigManager.getConfigForContext(context);
  }, [context, state.configs, state.customizations]);

  // Get available configurations that match the current context
  const availableConfigs = useMemo(() => {
    return state.configs.filter(config => 
      contextMatcher.matches(context, config.context)
    );
  }, [context, state.configs]);

  // Save a configuration
  const saveConfig = useCallback(async (config: ToolbarConfig) => {
    try {
      await toolbarConfigManager.saveConfig(config);
      
      setState(prev => {
        const existingIndex = prev.configs.findIndex(c => c.id === config.id);
        const updatedConfigs = [...prev.configs];
        
        if (existingIndex !== -1) {
          updatedConfigs[existingIndex] = config;
        } else {
          updatedConfigs.push(config);
        }
        
        return {
          ...prev,
          configs: updatedConfigs
        };
      });
    } catch (error) {
      console.error('Failed to save toolbar configuration:', error);
      throw error;
    }
  }, []);

  // Delete a configuration
  const deleteConfig = useCallback(async (configId: string) => {
    try {
      await toolbarConfigManager.deleteConfig(configId);
      
      setState(prev => ({
        ...prev,
        configs: prev.configs.filter(c => c.id !== configId),
        customizations: prev.customizations.filter(c => c.configId !== configId)
      }));
    } catch (error) {
      console.error('Failed to delete toolbar configuration:', error);
      throw error;
    }
  }, []);

  // Save a customization
  const saveCustomization = useCallback(async (customization: ToolbarCustomization) => {
    try {
      await toolbarConfigManager.saveCustomization(customization);
      
      setState(prev => {
        const existingIndex = prev.customizations.findIndex(
          c => c.configId === customization.configId && 
               JSON.stringify(c.contextFilter) === JSON.stringify(customization.contextFilter)
        );
        
        const updatedCustomizations = [...prev.customizations];
        
        if (existingIndex !== -1) {
          updatedCustomizations[existingIndex] = customization;
        } else {
          updatedCustomizations.push(customization);
        }
        
        return {
          ...prev,
          customizations: updatedCustomizations
        };
      });
    } catch (error) {
      console.error('Failed to save toolbar customization:', error);
      throw error;
    }
  }, []);

  // Toggle customization mode
  const toggleCustomization = useCallback(() => {
    setState(prev => ({
      ...prev,
      isCustomizing: !prev.isCustomizing,
      dragDropState: initialDragDropState
    }));
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((itemId: string, event: React.DragEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const startPosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    setState(prev => ({
      ...prev,
      dragDropState: {
        isDragging: true,
        draggedItemId: itemId,
        dragOverItemId: null,
        dragStartPosition: startPosition
      }
    }));

    // Set drag data
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((itemId: string, event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    setState(prev => ({
      ...prev,
      dragDropState: {
        ...prev.dragDropState,
        dragOverItemId: itemId
      }
    }));
  }, []);

  const handleDragLeave = useCallback(() => {
    setState(prev => ({
      ...prev,
      dragDropState: {
        ...prev.dragDropState,
        dragOverItemId: null
      }
    }));
  }, []);

  const handleDrop = useCallback(async (targetItemId: string, event: React.DragEvent) => {
    event.preventDefault();
    
    const draggedItemId = event.dataTransfer.getData('text/plain');
    
    if (!draggedItemId || !currentConfig || draggedItemId === targetItemId) {
      setState(prev => ({
        ...prev,
        dragDropState: initialDragDropState
      }));
      return;
    }

    try {
      // Find the items in the current configuration
      const draggedIndex = currentConfig.tools.findIndex(tool => tool.id === draggedItemId);
      const targetIndex = currentConfig.tools.findIndex(tool => tool.id === targetItemId);

      if (draggedIndex === -1 || targetIndex === -1) {
        return;
      }

      // Create new tools array with reordered items
      const newTools = [...currentConfig.tools];
      const [draggedItem] = newTools.splice(draggedIndex, 1);
      newTools.splice(targetIndex, 0, draggedItem);

      // Create customization for the reordering
      const customization: ToolbarCustomization = {
        configId: currentConfig.id,
        contextFilter: context,
        toolOverrides: newTools.map((tool, index) => ({
          id: tool.id,
          order: index
        })),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await saveCustomization(customization);
    } catch (error) {
      console.error('Failed to reorder toolbar items:', error);
    } finally {
      setState(prev => ({
        ...prev,
        dragDropState: initialDragDropState
      }));
    }
  }, [currentConfig, context, saveCustomization]);

  const handleDragEnd = useCallback(() => {
    setState(prev => ({
      ...prev,
      dragDropState: initialDragDropState
    }));
  }, []);

  // Toggle tool visibility
  const toggleToolVisibility = useCallback(async (toolId: string) => {
    if (!currentConfig) return;

    const tool = currentConfig.tools.find(t => t.id === toolId);
    if (!tool) return;

    const customization: ToolbarCustomization = {
      configId: currentConfig.id,
      contextFilter: context,
      toolOverrides: [{
        id: toolId,
        visible: !tool.visible
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveCustomization(customization);
  }, [currentConfig, context, saveCustomization]);

  // Update tool properties
  const updateTool = useCallback(async (toolId: string, updates: Partial<ToolbarItem>) => {
    if (!currentConfig) return;

    const customization: ToolbarCustomization = {
      configId: currentConfig.id,
      contextFilter: context,
      toolOverrides: [{
        id: toolId,
        customIcon: updates.icon,
        customLabel: updates.label,
        customShortcut: updates.shortcut,
        group: updates.group,
        visible: updates.visible,
        disabled: updates.disabled
      }],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveCustomization(customization);
  }, [currentConfig, context, saveCustomization]);

  // Reset customizations for current context
  const resetCustomizations = useCallback(async () => {
    if (!currentConfig) return;

    try {
      const customizationsToRemove = state.customizations.filter(
        c => c.configId === currentConfig.id &&
             JSON.stringify(c.contextFilter) === JSON.stringify(context)
      );

      for (const customization of customizationsToRemove) {
        const customizationId = `${customization.configId}-${JSON.stringify(customization.contextFilter)}`;
        await toolbarConfigManager.deleteCustomization(customizationId);
      }

      setState(prev => ({
        ...prev,
        customizations: prev.customizations.filter(
          c => !(c.configId === currentConfig.id &&
                 JSON.stringify(c.contextFilter) === JSON.stringify(context))
        )
      }));
    } catch (error) {
      console.error('Failed to reset customizations:', error);
      throw error;
    }
  }, [currentConfig, context, state.customizations]);

  // Export configurations
  const exportConfigs = useCallback(() => {
    return toolbarConfigManager.exportConfigs();
  }, []);

  // Import configurations
  const importConfigs = useCallback(async (data: string) => {
    try {
      await toolbarConfigManager.importConfigs(data);
      
      // Reload data
      const configs = toolbarConfigManager.getAllConfigs();
      const customizations = toolbarConfigManager.getAllCustomizations();
      
      setState(prev => ({
        ...prev,
        configs,
        customizations
      }));
    } catch (error) {
      console.error('Failed to import configurations:', error);
      throw error;
    }
  }, []);

  return {
    // State
    isLoaded,
    currentConfig,
    availableConfigs,
    isCustomizing: state.isCustomizing,
    dragDropState: state.dragDropState,
    
    // Actions
    saveConfig,
    deleteConfig,
    saveCustomization,
    toggleCustomization,
    
    // Drag and drop
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    
    // Tool management
    toggleToolVisibility,
    updateTool,
    resetCustomizations,
    
    // Import/Export
    exportConfigs,
    importConfigs
  };
};