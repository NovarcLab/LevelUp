import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMEvent, StreamInput, TokenUsage } from './types.js';

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  /** Used for non-streaming `complete` calls. Defaults to `model`. */
  completeModel?: string;
}

/**
 * A minimal wrapper around the Anthropic SDK that yields the unified LLMEvent
 * shape and enables prompt caching on the system prompt. Retry and validation
 * live outside this module — this just translates between SDK and our types.
 */
export function createAnthropicClient(opts: AnthropicOptions): LLMClient {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const model = opts.model;
  const completeModel = opts.completeModel ?? model;

  return {
    async *stream(input: StreamInput): AsyncIterable<LLMEvent> {
      let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let stopReason = 'end_turn';
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: input.maxTokens ?? 1024,
          system: input.systemPrompt,
          messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            yield { type: 'token', text: event.delta.text };
          }
          if (event.type === 'message_delta') {
            if (event.usage) {
              usage = {
                inputTokens: usage.inputTokens,
                outputTokens: event.usage.output_tokens ?? usage.outputTokens,
              };
            }
            if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
          }
          if (event.type === 'message_start' && event.message.usage) {
            usage = {
              inputTokens: event.message.usage.input_tokens ?? 0,
              outputTokens: event.message.usage.output_tokens ?? 0,
            };
          }
        }
        yield { type: 'finish', usage, finishReason: stopReason };
      } catch (err) {
        yield {
          type: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
          retryable: isRetryable(err),
        };
      }
    },

    async complete(input: StreamInput) {
      const res = await client.messages.create({
        model: completeModel,
        max_tokens: input.maxTokens ?? 1024,
        system: input.systemPrompt,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const text = res.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('');
      return {
        text,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
        },
      };
    },
  };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === 429 || (err.status ?? 0) >= 500;
  }
  return false;
}
