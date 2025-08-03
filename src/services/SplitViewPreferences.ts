/**
 * Service for managing SplitView preferences and persistence
 */

export interface SplitViewPreferences {
  defaultRatio: number;
  minLeftWidth: number;
  minRightWidth: number;
  rememberRatio: boolean;
  animationDuration: number;
}

export interface SplitViewState {
  splitRatio: number;
  lastUpdated: number;
}

const STORAGE_KEYS = {
  PREFERENCES: 'orbisjs-splitview-preferences',
  STATE: 'orbisjs-splitview-state'
} as const;

const DEFAULT_PREFERENCES: SplitViewPreferences = {
  defaultRatio: 0.6,
  minLeftWidth: 300,
  minRightWidth: 300,
  rememberRatio: true,
  animationDuration: 200
};

const DEFAULT_STATE: SplitViewState = {
  splitRatio: 0.6,
  lastUpdated: Date.now()
};

// Simple storage helpers
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? { ...defaultValue, ...JSON.parse(stored) } : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
}

export class SplitViewPreferencesManager {
  private preferences: SplitViewPreferences;
  private state: SplitViewState;

  constructor() {
    this.preferences = loadFromStorage(STORAGE_KEYS.PREFERENCES, DEFAULT_PREFERENCES);
    this.state = loadFromStorage(STORAGE_KEYS.STATE, DEFAULT_STATE);
    
    // Save defaults if first time
    if (!localStorage.getItem(STORAGE_KEYS.PREFERENCES)) {
      saveToStorage(STORAGE_KEYS.PREFERENCES, this.preferences);
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): SplitViewPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  updatePreferences(updates: Partial<SplitViewPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    saveToStorage(STORAGE_KEYS.PREFERENCES, this.preferences);
  }

  /**
   * Get current split ratio (from state if rememberRatio is enabled, otherwise from preferences)
   */
  getCurrentSplitRatio(): number {
    if (this.preferences.rememberRatio) {
      return this.state.splitRatio;
    }
    return this.preferences.defaultRatio;
  }

  /**
   * Update split ratio in state
   */
  updateSplitRatio(ratio: number): void {
    if (this.preferences.rememberRatio) {
      this.state = {
        splitRatio: ratio,
        lastUpdated: Date.now()
      };
      saveToStorage(STORAGE_KEYS.STATE, this.state);
    }
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.state = { ...DEFAULT_STATE };
    saveToStorage(STORAGE_KEYS.PREFERENCES, this.preferences);
    saveToStorage(STORAGE_KEYS.STATE, this.state);
  }

  /**
   * Migrate from old layout system preferences (if they exist)
   * This handles the requirement for preference migration from old layout system
   */
  migrateFromOldSystem(): boolean {
    try {
      // Check for old layout preferences that might exist
      const oldLayoutRatio = localStorage.getItem('orbisjs-layout-ratio');
      const oldLayoutPrefs = localStorage.getItem('orbisjs-layout-preferences');
      
      let migrated = false;

      if (oldLayoutRatio) {
        const ratio = parseFloat(oldLayoutRatio);
        if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
          this.state.splitRatio = ratio;
          saveToStorage(STORAGE_KEYS.STATE, this.state);
          localStorage.removeItem('orbisjs-layout-ratio');
          migrated = true;
        }
      }

      if (oldLayoutPrefs) {
        try {
          const oldPrefs = JSON.parse(oldLayoutPrefs);
          const updates: Partial<SplitViewPreferences> = {};
          
          if (typeof oldPrefs.defaultRatio === 'number') {
            updates.defaultRatio = oldPrefs.defaultRatio;
          }
          if (typeof oldPrefs.minLeftWidth === 'number') {
            updates.minLeftWidth = oldPrefs.minLeftWidth;
          }
          if (typeof oldPrefs.minRightWidth === 'number') {
            updates.minRightWidth = oldPrefs.minRightWidth;
          }
          if (typeof oldPrefs.rememberRatio === 'boolean') {
            updates.rememberRatio = oldPrefs.rememberRatio;
          }

          if (Object.keys(updates).length > 0) {
            this.updatePreferences(updates);
            localStorage.removeItem('orbisjs-layout-preferences');
            migrated = true;
          }
        } catch (error) {
          console.warn('Failed to parse old layout preferences:', error);
        }
      }

      return migrated;
    } catch (error) {
      console.warn('Failed to migrate from old layout system:', error);
      return false;
    }
  }

  /**
   * Export preferences and state for backup/sharing
   */
  exportSettings(): { preferences: SplitViewPreferences; state: SplitViewState } {
    return {
      preferences: { ...this.preferences },
      state: { ...this.state }
    };
  }

  /**
   * Import preferences and state from backup
   */
  importSettings(settings: { preferences?: Partial<SplitViewPreferences>; state?: Partial<SplitViewState> }): void {
    if (settings.preferences) {
      this.updatePreferences(settings.preferences);
    }
    
    if (settings.state) {
      this.state = { ...this.state, ...settings.state };
      saveToStorage(STORAGE_KEYS.STATE, this.state);
    }
  }
}

// Singleton instance
export const splitViewPreferences = new SplitViewPreferencesManager();