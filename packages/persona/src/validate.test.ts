import { describe, it, expect } from 'vitest';
import { validateResponse } from './validate.js';

describe('validateResponse', () => {
  it('accepts a plain factual reply', () => {
    const r = validateResponse("You got three sections in. Where did you stop?");
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it('catches forbidden English openings', () => {
    expect(validateResponse('Sure, here is the plan.').ok).toBe(false);
    expect(validateResponse('Of course! Let me help.').ok).toBe(false);
    expect(validateResponse("I'd be happy to help you.").ok).toBe(false);
  });

  it('catches forbidden Chinese openings', () => {
    expect(validateResponse('当然可以，我来帮你。').ok).toBe(false);
    expect(validateResponse('好问题，我的看法是…').ok).toBe(false);
    expect(validateResponse('希望对你有帮助。').ok).toBe(false);
  });

  it('catches mid-text cliches', () => {
    const r = validateResponse('You did it. 太棒了, 继续加油!');
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === 'cliche')).toBe(true);
  });

  it('catches emojis', () => {
    const r = validateResponse('Nice work 👍');
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.type === 'emoji')).toBe(true);
  });

  it('catches marketing tone', () => {
    expect(validateResponse('Unlock your potential!').ok).toBe(false);
  });

  it('does not false-positive plain English', () => {
    const samples = [
      'You said three weeks ago you might not make it. You did.',
      'Where did you get stuck?',
      "I'm here. Do you want to talk, or do you want silence for a bit?",
      "That's three sections done. Two more to go.",
    ];
    for (const s of samples) {
      const r = validateResponse(s);
      expect(r.ok, `should accept: ${s}`).toBe(true);
    }
  });
});
