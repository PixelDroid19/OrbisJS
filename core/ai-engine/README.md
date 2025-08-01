# AI Engine

The AI Engine provides a unified interface for interacting with multiple AI providers, featuring automatic fallback, load balancing, and conversation management.

## Features

- **Multi-Provider Support**: Integrate multiple AI providers (OpenRouter, Transformers.js, AI SDK, LangChain.js)
- **Automatic Fallback**: Seamlessly fallback to alternative providers when primary fails
- **Load Balancing**: Route requests to the most appropriate provider based on capabilities and priority
- **Conversation Management**: Maintain conversation history and context across interactions
- **Streaming Support**: Real-time streaming responses for better user experience
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

```typescript
import { createAIEngine, BaseAIProvider } from './core/ai-engine';

// Create AI Engine instance
const aiEngine = createAIEngine({
  fallbackEnabled: true,
  maxRetries: 3,
  timeoutMs: 30000
});

// Create a custom provider
class MyAIProvider extends BaseAIProvider {
  constructor() {
    super('my-provider', 'My AI Provider', 'remote', ['chat', 'completion']);
  }

  async ask(prompt: string, context?: AIContext): Promise<string> {
    // Your AI provider implementation
    return 'AI response';
  }

  async complete(code: string, position?: number): Promise<string> {
    // Your code completion implementation
    return 'completed code';
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

// Add provider to engine
const provider = new MyAIProvider();
aiEngine.addProvider(provider);

// Initialize engine
await aiEngine.initialize();

// Use AI features
const response = await aiEngine.ask('Hello, AI!');
const completion = await aiEngine.completeCode('function test() {');
const explanation = await aiEngine.explainCode('const x = 5;');
```

## Core Concepts

### AI Providers

AI Providers are the core abstraction for different AI services. Each provider implements the `AIProvider` interface and can support different capabilities:

- `chat`: General conversation and question answering
- `completion`: Code completion and generation
- `explanation`: Code explanation and documentation
- `generation`: Function and component generation
- `refactoring`: Code refactoring and improvement
- `streaming`: Real-time streaming responses

### Provider Priority and Fallback

Providers are ordered by priority (higher numbers = higher priority). When a request is made:

1. The engine selects providers that support the required capability
2. Providers are tried in priority order
3. If a provider fails and fallback is enabled, the next provider is tried
4. If all providers fail, an error is thrown

### Conversation Management

The AI Engine supports persistent conversations:

```typescript
// Start a new conversation
const conversationId = aiEngine.startConversation();

// Continue the conversation
const response1 = await aiEngine.continueConversation(conversationId, 'Hello!');
const response2 = await aiEngine.continueConversation(conversationId, 'How are you?');

// End the conversation
aiEngine.endConversation(conversationId);
```

### Context-Aware AI

The AI Engine supports rich context for better responses:

```typescript
const context: AIContext = {
  currentFile: 'src/components/Button.tsx',
  selection: 'const Button = () => {',
  language: 'typescript',
  projectStructure: fileTree,
  executionHistory: previousResults
};

const response = await aiEngine.ask('Explain this code', context);
```

## API Reference

### AIEngine Interface

#### Core Operations
- `ask(prompt, context?, providerId?)`: General AI conversation
- `completeCode(code, position?, context?)`: Code completion
- `explainCode(code, context?)`: Code explanation
- `generateFunction(description, context?)`: Function generation
- `refactorCode(code, instruction, context?)`: Code refactoring

#### Provider Management
- `addProvider(provider)`: Add a new AI provider
- `removeProvider(providerId)`: Remove a provider
- `setProviderPriority(providerId, priority)`: Update provider priority
- `getProvider(providerId)`: Get a specific provider
- `listProviders()`: List all providers

#### Conversation Management
- `startConversation(providerId?)`: Start a new conversation
- `continueConversation(id, message, context?)`: Continue conversation
- `endConversation(id)`: End a conversation
- `getConversation(id)`: Get conversation details
- `listConversations()`: List all conversations

#### Streaming
- `askStream(prompt, callback, context?, providerId?)`: Streaming responses

#### Configuration
- `configure(config)`: Update engine configuration
- `getConfig()`: Get current configuration

#### Lifecycle
- `initialize()`: Initialize the engine and all providers
- `destroy()`: Clean up resources

### BaseAIProvider Abstract Class

Extend this class to create custom AI providers:

```typescript
class CustomProvider extends BaseAIProvider {
  constructor() {
    super('custom', 'Custom Provider', 'remote', ['chat', 'completion']);
  }

  async ask(prompt: string, context?: AIContext): Promise<string> {
    // Implementation required
  }

  async complete(code: string, position?: number): Promise<string> {
    // Implementation required
  }

  async isAvailable(): Promise<boolean> {
    // Implementation required
  }

  // Optional: Override for custom initialization
  protected async doInitialize(): Promise<void> {
    // Custom initialization logic
  }

  // Optional: Override for custom cleanup
  protected async doDestroy(): Promise<void> {
    // Custom cleanup logic
  }

  // Optional: Override for streaming support
  async askStream?(prompt: string, callback: (chunk: string) => void, context?: AIContext): Promise<void> {
    // Custom streaming implementation
  }
}
```

## Error Handling

The AI Engine provides comprehensive error handling:

```typescript
import { AIError } from './core/ai-engine';

try {
  const response = await aiEngine.ask('Hello');
} catch (error) {
  if (error instanceof AIError) {
    console.log('AI Error:', error.code, error.providerId, error.retryable);
  }
}
```

Error codes:
- `PROVIDER_UNAVAILABLE`: Provider is not available
- `QUOTA_EXCEEDED`: API quota exceeded
- `INVALID_RESPONSE`: Invalid response from provider
- `TIMEOUT`: Request timed out
- `UNKNOWN`: Unknown error

## Configuration

```typescript
const config: AIEngineConfig = {
  defaultProvider: 'openrouter',  // Default provider ID
  fallbackEnabled: true,          // Enable automatic fallback
  maxRetries: 3,                  // Maximum retry attempts
  timeoutMs: 30000               // Request timeout in milliseconds
};

aiEngine.configure(config);
```

## Testing

The AI Engine includes comprehensive unit tests. Run tests with:

```bash
npm test -- core/ai-engine
```

Mock providers are available for testing:

```typescript
import { BaseAIProvider } from './core/ai-engine';

class MockProvider extends BaseAIProvider {
  // Test implementation
}
```

## Best Practices

1. **Provider Priority**: Set higher priority for more reliable/faster providers
2. **Capability Matching**: Only implement capabilities your provider actually supports
3. **Error Handling**: Implement proper error handling with appropriate error codes
4. **Resource Cleanup**: Always call `destroy()` when done with the engine
5. **Context Usage**: Provide rich context for better AI responses
6. **Streaming**: Use streaming for better user experience with long responses

## Integration Examples

### With React

```typescript
import { useEffect, useState } from 'react';
import { getDefaultAIEngine } from './core/ai-engine';

function AIChat() {
  const [engine] = useState(() => getDefaultAIEngine());
  const [response, setResponse] = useState('');

  useEffect(() => {
    engine.initialize();
    return () => engine.destroy();
  }, []);

  const handleAsk = async (prompt: string) => {
    const result = await engine.ask(prompt);
    setResponse(result);
  };

  return (
    <div>
      <button onClick={() => handleAsk('Hello!')}>
        Ask AI
      </button>
      <p>{response}</p>
    </div>
  );
}
```

### With Streaming

```typescript
const handleStreamingAsk = async (prompt: string) => {
  let fullResponse = '';
  
  await engine.askStream(prompt, (chunk) => {
    fullResponse += chunk;
    setResponse(fullResponse);
  });
};
```