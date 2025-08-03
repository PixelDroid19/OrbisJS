# Project Structure

## Root Level
- `src/` - React frontend application
- `electron/` - Electron main and preload processes
- `core/` - Shared business logic modules
- `app/` - Application-specific modules
- `public/` - Static assets
- `dist/` - Vite build output
- `dist-electron/` - Electron build output
- `release/` - Packaged application releases

## Core Architecture (`core/`)
The core directory contains reusable, framework-agnostic modules:

- `core/ai-engine/` - AI provider abstraction and management
- `core/editor/` - CodeMirror editor components and services
- `core/runner/` - Code execution engine with WebContainer
- `core/mcp/` - Model Context Protocol integration
- `core/plugin/` - Plugin system architecture
- `core/storage/` - Data persistence layer

## Frontend Structure (`src/`)
- `src/App.tsx` - Main application component with tab management
- `src/components/` - Reusable UI components
- `src/hooks/` - Custom React hooks (useTabs, useWebContainer)
- `src/assets/` - Frontend-specific assets
- `*.css` - Component and global styles

## Application Modules (`app/`)
- `app/chat/` - AI chat interface components
- `app/generator/` - Code generation features

## Key Files
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Build configuration with Electron plugin
- `tsconfig.json` - TypeScript configuration (strict mode)
- `electron-builder.json5` - Desktop app packaging config
- `.eslintrc.cjs` - Code quality rules

## Naming Conventions
- **Components**: PascalCase (e.g., `EditorComponent.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTabs.ts`)
- **Services**: PascalCase with Service suffix (e.g., `CompletionService.ts`)
- **Types**: PascalCase interfaces/types (e.g., `LanguageType`)
- **Constants**: UPPER_SNAKE_CASE for module constants

## Import Patterns
- Relative imports for local modules: `./components/TabBar`
- Absolute imports for core modules: `../core/editor`
- External dependencies: Standard npm imports
- Type-only imports: `import type { ... }`