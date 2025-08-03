

# 🧩 **Design Document — OrbisJS SplitView + Floating Toolbar Redesign**

## 🧠 Overview

This redesign modernizes the OrbisJS editor interface by transitioning from a traditional **vertical stacked layout** (editor above, results below) to a **horizontal split view** inspired by modern tools like *Vite*, *StackBlitz*, and *RunJS*.

The new layout removes the legacy personalization system and introduces a **minimal, context-aware Floating Toolbar system**, providing relevant tools without clutter.

> 📌 *Goal*: Create a cleaner, faster, modular UI that supports future extensibility and contextual tool customization.

---

## 🧱 Architecture

### 🔲 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                          Header                             │
├────────────────────────────┬────────────────────────────────┤
│                            │                                │
│        Editor Panel        │       Results/Render Panel     │
│                            │                                │
│                            │                                │
│                ┌────────────────────────┐                   │
│                │      Floating Toolbar   │                  │
│                └────────────────────────┘                   │
├────────────────────────────┼────────────────────────────────┤
│                          Footer                             │
└─────────────────────────────────────────────────────────────┘
```

### ⚙️ Component Hierarchy

```
App
├── Header
│   ├── AppTitle
│   ├── TabBar
│   └── StatusIndicator
├── SplitView (new)
│   ├── EditorPanel
│   │   ├── EditorComponent
│   │   └── FloatingToolbar (new)
│   └── ResultsPanel
│       ├── ResultsHeader
│       └── ResultsContent
└── Footer
    ├── RunControls
    └── StatusBar
```

---

## 🧩 Components & Interfaces

### 1. `SplitView`

```ts
interface SplitViewProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultSplitRatio?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
  onSplitChange?: (ratio: number) => void;
}

interface SplitViewState {
  splitRatio: number;
  isDragging: boolean;
  leftWidth: number;
  rightWidth: number;
}
```

**Features**:

* Drag-to-resize with smooth animation
* Persistence of split ratio
* Enforced min widths
* Keyboard accessibility

---

### 2. `FloatingToolbar`

```ts
interface FloatingToolbarProps {
  visible: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  context: ToolbarContext;
  tools: ToolbarItem[];
  onToggle: () => void;
  onCustomize?: () => void;
}

interface ToolbarContext {
  fileType: LanguageType;
  editorState: EditorState;
  hasSelection: boolean;
  isReadOnly: boolean;
}

interface ToolbarItem {
  id: string;
  icon: string;
  label: string;
  action: () => void;
  shortcut?: string;
  visible: boolean;
  disabled?: boolean;
  group?: string;
}
```

**Features**:

* Context-aware tool visibility
* Drag-to-reorder
* Support for user-customized toolbars
* Smooth show/hide animation

---

### 3. `EditorPanel`

```ts
interface EditorPanelProps {
  activeTab: Tab | null;
  onContentChange: (content: string) => void;
  onLanguageChange: (language: LanguageType) => void;
  toolbarVisible: boolean;
  onToolbarToggle: () => void;
}
```

**Features**:

* Integrates FloatingToolbar
* Manages focus/visibility
* Responsive to layout changes

---

### 4. `ResultsPanel`

```ts
interface ResultsPanelProps {
  output: string;
  error: string;
  isRunning: boolean;
  runnerStatus: RunnerStatus;
  onRetry: () => void;
  onHardReset: () => void;
}
```

**Features**:

* Optimized scrolling/layout
* Enhanced error visibility
* Responsive for compressed widths

---

## 🗃️ Data Models

### Toolbar Configuration

```ts
interface ToolbarConfig {
  id: string;
  name: string;
  context: ToolbarContext;
  tools: ToolbarItem[];
  position: ToolbarPosition;
  autoHide: boolean;
  customizations: ToolbarCustomization[];
}

interface ToolbarCustomization {
  userId: string;
  contextFilter: Partial<ToolbarContext>;
  toolOverrides: Partial<ToolbarItem>[];
  positionOverride?: ToolbarPosition;
}
```

### SplitView Preferences

```ts
interface SplitViewPreferences {
  defaultRatio: number;
  minLeftWidth: number;
  minRightWidth: number;
  rememberRatio: boolean;
  animationDuration: number;
}
```

### Layout State

```ts
interface LayoutState {
  splitRatio: number;
  toolbarVisible: boolean;
  toolbarPosition: ToolbarPosition;
  activeToolbarConfig: string;
  customToolbars: ToolbarConfig[];
}
```

---

## 🔐 Error Handling

* **SplitView**: minimum-width protection, resize race-condition debouncing
* **Toolbar**: fallback positioning, failure-proof action execution
* **Migration**: graceful cleanup of legacy config + preference converters


## ⚡ Implementation Notes

* **CSS**: Grid for layout, flex for toolbar, CSS vars for responsive splits
* **State**: React Context + localStorage for persistence
* **Performance**: `React.memo`, `useCallback`, debounced resize handlers
* **Browser Support**: CSS grid custom-property fallbacks, ResizeObserver polyfill


