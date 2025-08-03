# Technology Stack

## Core Technologies
- **Frontend**: React 18 + TypeScript + Vite
- **Desktop**: Electron 30+ with IPC communication
- **Editor**: CodeMirror 6 with custom extensions
- **Code Execution**: WebContainer API for local sandboxed execution
- **AI Integration**: AI SDK with multiple provider support
- **Build System**: Vite + Electron Builder

## Key Dependencies
- **Editor**: CodeMirror 6 ecosystem (`@codemirror/*` packages)
- **AI Providers**: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, etc.
- **Code Processing**: Babel standalone for transpilation
- **Runtime**: WebContainer API for secure code execution
- **ML**: Xenova Transformers for local AI capabilities
- **Language Chain**: LangChain for AI workflow orchestration

## Development Tools
- **TypeScript**: Strict mode enabled with ES2020 target
- **ESLint**: Standard React/TypeScript configuration
- **Testing**: Vitest with jsdom environment
- **Build**: Electron Builder for cross-platform packaging

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run test:run     # Run tests once
npm run preview      # Preview production build
```

### Architecture Notes
- Uses ES modules throughout (`"type": "module"`)
- Electron main/renderer process separation
- WebContainer for secure code execution
- Cross-Origin headers configured for WebContainer compatibility
- Strict TypeScript configuration with unused parameter checking