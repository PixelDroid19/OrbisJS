import type { LanguageType } from '../../core/editor';
import type { ToolbarItem, ToolbarPosition, ToolbarContext } from '../components/FloatingToolbar';

export interface ToolbarConfig {
  id: string;
  name: string;
  context: ToolbarContextFilter;
  tools: ToolbarItem[];
  position: ToolbarPosition;
  autoHide: boolean;
  isDefault: boolean;
  // Simplified - include customizations directly
  toolCustomizations?: ToolbarItemCustomization[];
  createdAt: number;
  updatedAt: number;
}

export interface ToolbarContextFilter {
  fileType?: LanguageType;
  hasSelection?: boolean;
  isReadOnly?: boolean;
}

// Simplified - merge customization into config
export interface ToolbarItemCustomization {
  id: string;
  visible?: boolean;
  order?: number;
}

export interface DragDropState {
  isDragging: boolean;
  draggedItemId: string | null;
  dragOverItemId: string | null;
  dragStartPosition: { x: number; y: number } | null;
}

export interface ToolbarConfigurationState {
  configs: ToolbarConfig[];
  activeConfigId: string | null;
  isCustomizing: boolean;
  dragDropState: DragDropState;
}

// Simplified context matching - just a function
export type ContextMatcher = (context: ToolbarContext, filter: ToolbarContextFilter) => boolean;

// Simplified manager interface
export interface ToolbarConfigManager {
  getConfigForContext(context: ToolbarContext): ToolbarConfig | null;
  saveConfig(config: ToolbarConfig): Promise<void>;
  deleteConfig(configId: string): Promise<void>;
  resetToDefaults(): Promise<void>;
}