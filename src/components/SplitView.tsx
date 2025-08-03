import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSplitViewPreferences } from '../hooks/useSplitViewPreferences';
import './SplitView.css';

export interface SplitViewProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultSplitRatio?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  onSplitChange?: (ratio: number) => void;
  className?: string;
  usePreferences?: boolean; // Whether to use the preferences system
}

export interface SplitViewState {
  splitRatio: number;
  isDragging: boolean;
}

export const SplitView: React.FC<SplitViewProps> = ({
  leftPanel,
  rightPanel,
  defaultSplitRatio = 0.6,
  minLeftWidth = 300,
  minRightWidth = 300,
  onSplitChange,
  className = '',
  usePreferences = true
}) => {
  const {
    preferences,
    currentSplitRatio,
    updateSplitRatio: updatePreferencesSplitRatio,
    migrateFromOldSystem
  } = useSplitViewPreferences();

  // Use preferences if enabled, otherwise use props
  const effectiveMinLeftWidth = usePreferences ? preferences.minLeftWidth : minLeftWidth;
  const effectiveMinRightWidth = usePreferences ? preferences.minRightWidth : minRightWidth;
  const initialSplitRatio = usePreferences ? currentSplitRatio : defaultSplitRatio;

  const [state, setState] = useState<SplitViewState>({
    splitRatio: initialSplitRatio,
    isDragging: false
  });

  // Migrate from old system on mount
  useEffect(() => {
    if (usePreferences) {
      const migrated = migrateFromOldSystem();
      if (migrated) {
        // Update state with migrated ratio
        setState(prev => ({ ...prev, splitRatio: currentSplitRatio }));
      }
    }
  }, [usePreferences, migrateFromOldSystem, currentSplitRatio]);

  // Update state when preferences change
  useEffect(() => {
    if (usePreferences) {
      setState(prev => ({ ...prev, splitRatio: currentSplitRatio }));
    }
  }, [usePreferences, currentSplitRatio]);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startRatioRef = useRef<number>(defaultSplitRatio);

  // Handle mouse down on resizer
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    startXRef.current = e.clientX;
    startRatioRef.current = state.splitRatio;
    
    setState(prev => ({ ...prev, isDragging: true }));
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = e.clientX - startXRef.current;
      const deltaRatio = deltaX / containerWidth;
      let newRatio = startRatioRef.current + deltaRatio;
      
      // Apply minimum width constraints
      const minLeftRatio = effectiveMinLeftWidth / containerWidth;
      const minRightRatio = effectiveMinRightWidth / containerWidth;
      
      newRatio = Math.max(minLeftRatio, Math.min(1 - minRightRatio, newRatio));
      
      setState(prev => ({ ...prev, splitRatio: newRatio }));
      
      // Update preferences if enabled
      if (usePreferences) {
        updatePreferencesSplitRatio(newRatio);
      }
      
      onSplitChange?.(newRatio);
    };

    const handleMouseUp = () => {
      setState(prev => ({ ...prev, isDragging: false }));
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [state.splitRatio, effectiveMinLeftWidth, effectiveMinRightWidth, onSplitChange, usePreferences, updatePreferencesSplitRatio]);

  return (
    <div 
      ref={containerRef}
      className={`split-view ${className} ${state.isDragging ? 'dragging' : ''}`}
      style={{
        '--split-ratio': state.splitRatio
      } as React.CSSProperties}
    >
      <div className="split-panel split-panel-left">
        {leftPanel}
      </div>
      
      <div 
        ref={resizerRef}
        className="split-resizer"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        tabIndex={0}
        onKeyDown={(e) => {
          // Handle keyboard navigation for accessibility
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const containerWidth = containerRef.current?.offsetWidth || 1000;
            const step = 50 / containerWidth; // 50px step
            const direction = e.key === 'ArrowLeft' ? -step : step;
            let newRatio = state.splitRatio + direction;
            
            // Apply constraints
            const minLeftRatio = effectiveMinLeftWidth / containerWidth;
            const minRightRatio = effectiveMinRightWidth / containerWidth;
            newRatio = Math.max(minLeftRatio, Math.min(1 - minRightRatio, newRatio));
            
            setState(prev => ({ ...prev, splitRatio: newRatio }));
            
            // Update preferences if enabled
            if (usePreferences) {
              updatePreferencesSplitRatio(newRatio);
            }
            
            if (onSplitChange) {
              onSplitChange(newRatio);
            }
          }
        }}
      >
        <div className="split-resizer-handle" />
      </div>
      
      <div className="split-panel split-panel-right">
        {rightPanel}
      </div>
    </div>
  );
};

export default SplitView;