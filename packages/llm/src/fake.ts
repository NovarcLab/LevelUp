import type { LLMClient, LLMEvent, StreamInput, TokenUsage } from './types.js';

export interface FakeLLMOptions {
  /** Function that produces a response for a given input. */
  reply: (input: StreamInput) => string | Promise<string>;
}

/**
 * A scripted LLMClient used in tests and local dev when no API key is set.
 * Yields the reply one word at a time so SSE streaming code paths exercise.
 */
export function createFakeLLM(opts: FakeLLMOptions): LLMClient {
  const reply = opts.reply;
  return {
    async *stream(input: StreamInput): AsyncIterable<LLMEvent> {
      const text = await reply(input);
      const words = text.split(/(\s+)/);
      for (const w of words) {
        if (w.length === 0) continue;
        yield { type: 'token', text: w };
      }
      const usage: TokenUsage = {
        inputTokens: estimateTokens(input.systemPrompt + JSON.stringify(input.messages)),
        outputTokens: estimateTokens(text),
      };
      yield { type: 'finish', usage, finishReason: 'end_turn' };
    },
    async complete(input: StreamInput) {
      const text = await reply(input);
      return {
        text,
        usage: {
          inputTokens: estimateTokens(input.systemPrompt),
          outputTokens: estimateTokens(text),
        },
      };
    },
  };
}

function estimateTokens(text: string): number {
  // Crude approximation — good enough for tests.
  return Math.ceil(text.length / 3);
}
