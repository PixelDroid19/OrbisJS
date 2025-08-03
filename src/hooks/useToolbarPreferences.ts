import { useState, useEffect, useCallback } from 'react';
import type { ToolbarPosition } from '../components/FloatingToolbar';

export interface ToolbarPreferences {
  visible: boolean;
  position: ToolbarPosition;
  autoHide: boolean;
  keyboardShortcutsEnabled: boolean;
}

const DEFAULT_PREFERENCES: ToolbarPreferences = {
  visible: true,
  position: 'top-right',
  autoHide: false,
  keyboardShortcutsEnabled: true
};

const STORAGE_KEY = 'orbisjs-toolbar-preferences';

const saveToStorage = (preferences: ToolbarPreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save toolbar preferences to localStorage:', error);
  }
};

export const useToolbarPreferences = () => {
  const [preferences, setPreferences] = useState<ToolbarPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ToolbarPreferences>;
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load toolbar preferences from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  const savePreferences = useCallback((newPreferences: Partial<ToolbarPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPreferences };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save toolbar preferences to localStorage:', error);
      }
      return updated;
    });
  }, []);

  // Toggle toolbar visibility
  const toggleVisibility = useCallback(() => {
    setPreferences(prev => {
      const updated = { ...prev, visible: !prev.visible };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save toolbar preferences to localStorage:', error);
      }
      return updated;
    });
  }, []);

  // Set toolbar position
  const setPosition = useCallback((position: ToolbarPosition) => {
    savePreferences({ position });
  }, [savePreferences]);

  // Toggle auto-hide behavior
  const toggleAutoHide = useCallback(() => {
    setPreferences(prev => {
      const updated = { ...prev, autoHide: !prev.autoHide };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save toolbar preferences to localStorage:', error);
      }
      return updated;
    });
  }, []);

  // Toggle keyboard shortcuts
  const toggleKeyboardShortcuts = useCallback(() => {
    setPreferences(prev => {
      const updated = { ...prev, keyboardShortcutsEnabled: !prev.keyboardShortcutsEnabled };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.warn('Failed to save toolbar preferences to localStorage:', error);
      }
      return updated;
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    try {
      setPreferences(DEFAULT_PREFERENCES);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to reset toolbar preferences:', error);
    }
  }, []);

  return {
    preferences,
    isLoaded,
    toggleVisibility,
    setPosition,
    toggleAutoHide,
    toggleKeyboardShortcuts,
    savePreferences,
    resetToDefaults
  };
};

export default useToolbarPreferences;