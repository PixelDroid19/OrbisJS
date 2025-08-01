import React, { useState, useRef, useEffect } from 'react';

interface FloatingToolbarProps {
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  onTogglePackages: () => void;
  isRunning: boolean;
  installedPackagesCount: number;
  /**
   * Posición de la barra: bottom (centro), top, bottom-left, bottom-right, top-left, top-right
   * O usa 'free' para posición libre arrastrable
   */
  placement?: 'bottom' | 'top' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'free';
  /**
   * Posición inicial cuando placement es 'free' (en píxeles)
   */
  initialPosition?: { x: number; y: number };
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  onRun,
  onStop,
  onSave,
  onTogglePackages,
  isRunning,
  installedPackagesCount,
  placement = 'bottom',
  initialPosition = { x: 50, y: 50 },
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || placement !== 'free') return;
      
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, placement]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (placement !== 'free') return;
    
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  if (placement === 'free') {
    return (
      <div
        ref={toolbarRef}
        className="floating-toolbar free"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 1000,
          cursor: 'move',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="toolbar-handle">
          <span className="handle-dots">⋮⋮</span>
        </div>
        <button
          className="toolbar-btn"
          onClick={onRun}
          title="Ejecutar"
        >
          ▶
        </button>
        <button
          className="toolbar-btn"
          onClick={onStop}
          disabled={!isRunning}
          title="Detener"
        >
          ⏹
        </button>
        <button
          className="toolbar-btn"
          onClick={onSave}
          title="Guardar"
        >
          💾
        </button>
        <button
          className="toolbar-btn"
          onClick={onTogglePackages}
          title="Gestión de Paquetes"
        >
          📦 {installedPackagesCount}
        </button>
      </div>
    );
  }

  return (
    <div className={`floating-toolbar ${placement}`}>
      <button
        className="toolbar-btn"
        onClick={onRun}
        title="Ejecutar"
      >
        ▶
      </button>
      <button
        className="toolbar-btn"
        onClick={onStop}
        disabled={!isRunning}
        title="Detener"
      >
        ⏹
      </button>
      <button
        className="toolbar-btn"
        onClick={onSave}
        title="Guardar"
      >
        💾
      </button>
      <button
        className="toolbar-btn"
        onClick={onTogglePackages}
        title="Gestión de Paquetes"
      >
        📦 {installedPackagesCount}
      </button>
    </div>
  );
};