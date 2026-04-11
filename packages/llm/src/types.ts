export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamInput {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}

export type LLMEvent =
  | { type: 'token'; text: string }
  | { type: 'finish'; usage: TokenUsage; finishReason: string }
  | { type: 'error'; error: Error; retryable: boolean };

export interface SummarizeInput {
  messages: ChatMessage[];
  instructions: string;
}

export interface LLMClient {
  stream(input: StreamInput): AsyncIterable<LLMEvent>;
  complete(input: StreamInput): Promise<{ text: string; usage: TokenUsage }>;
}
