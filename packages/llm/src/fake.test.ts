import { describe, it, expect } from 'vitest';
import { createFakeLLM } from './fake.js';

describe('createFakeLLM', () => {
  it('streams a scripted reply token by token', async () => {
    const client = createFakeLLM({ reply: () => 'You got three sections in.' });
    const tokens: string[] = [];
    let finished = false;
    for await (const event of client.stream({
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      if (event.type === 'token') tokens.push(event.text);
      if (event.type === 'finish') finished = true;
    }
    expect(tokens.join('')).toContain('You');
    expect(tokens.join('')).toContain('sections');
    expect(finished).toBe(true);
  });

  it('complete returns full text and usage', async () => {
    const client = createFakeLLM({ reply: () => 'ok' });
    const out = await client.complete({
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(out.text).toBe('ok');
    expect(out.usage.outputTokens).toBeGreaterThan(0);
  });
});
