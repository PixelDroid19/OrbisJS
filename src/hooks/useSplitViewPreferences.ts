import { useState, useEffect, useCallback } from 'react';
import { 
  SplitViewPreferences, 
  SplitViewPreferencesManager, 
  splitViewPreferences 
} from '../services/SplitViewPreferences';

export interface UseSplitViewPreferencesReturn {
  preferences: SplitViewPreferences;
  currentSplitRatio: number;
  updatePreferences: (updates: Partial<SplitViewPreferences>) => void;
  updateSplitRatio: (ratio: number) => void;
  resetToDefaults: () => void;
  migrateFromOldSystem: () => boolean;
}

/**
 * Custom hook for managing split view preferences
 */
export function useSplitViewPreferences(): UseSplitViewPreferencesReturn {
  const [preferences, setPreferences] = useState<SplitViewPreferences>(
    splitViewPreferences.getPreferences()
  );
  const [currentSplitRatio, setCurrentSplitRatio] = useState<number>(
    splitViewPreferences.getCurrentSplitRatio()
  );

  // Update preferences
  const updatePreferences = useCallback((updates: Partial<SplitViewPreferences>) => {
    splitViewPreferences.updatePreferences(updates);
    setPreferences(splitViewPreferences.getPreferences());
    
    // If defaultRatio was updated and rememberRatio is false, update current ratio
    if (updates.defaultRatio !== undefined && !splitViewPreferences.getPreferences().rememberRatio) {
      setCurrentSplitRatio(updates.defaultRatio);
    }
  }, []);

  // Update split ratio
  const updateSplitRatio = useCallback((ratio: number) => {
    splitViewPreferences.updateSplitRatio(ratio);
    setCurrentSplitRatio(ratio);
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    splitViewPreferences.resetToDefaults();
    setPreferences(splitViewPreferences.getPreferences());
    setCurrentSplitRatio(splitViewPreferences.getCurrentSplitRatio());
  }, []);

  // Migrate from old system
  const migrateFromOldSystem = useCallback(() => {
    const migrated = splitViewPreferences.migrateFromOldSystem();
    if (migrated) {
      setPreferences(splitViewPreferences.getPreferences());
      setCurrentSplitRatio(splitViewPreferences.getCurrentSplitRatio());
    }
    return migrated;
  }, []);

  // Effect to handle preference changes from other components/tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'orbisjs-splitview-preferences' || e.key === 'orbisjs-splitview-state') {
        setPreferences(splitViewPreferences.getPreferences());
        setCurrentSplitRatio(splitViewPreferences.getCurrentSplitRatio());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    preferences,
    currentSplitRatio,
    updatePreferences,
    updateSplitRatio,
    resetToDefaults,
    migrateFromOldSystem
  };
}