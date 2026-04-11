export interface Violation {
  type: 'forbidden_opening' | 'cliche' | 'emoji' | 'marketing_tone';
  snippet: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

const FORBIDDEN_OPENINGS: RegExp[] = [
  /^当然可以/,
  /^好的[,，]/,
  /^好问题/,
  /^希望对你有帮助/,
  /^让我们一起/,
  /^作为(一个)?\s*ai/i,
  /^as an ai/i,
  /^sure[,!]/i,
  /^of course[,!]/i,
  /^certainly[,!]/i,
  /^i'd be happy to/i,
  /^great question/i,
];

const CLICHES: string[] = [
  '太棒了',
  '继续加油',
  '相信你一定可以',
  '你一定行的',
  '你真的很棒',
  '加油！',
  '加油!',
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u;

const MARKETING_RE = /\b(unlock|empower|elevate|transform your life|game-?changer)\b/i;

export function validateResponse(text: string): ValidationResult {
  const violations: Violation[] = [];
  const head = text.trimStart().slice(0, 64);

  for (const re of FORBIDDEN_OPENINGS) {
    if (re.test(head)) {
      violations.push({ type: 'forbidden_opening', snippet: head.slice(0, 24) });
      break;
    }
  }

  for (const phrase of CLICHES) {
    if (text.includes(phrase)) {
      violations.push({ type: 'cliche', snippet: phrase });
    }
  }

  const emojiMatch = EMOJI_RE.exec(text);
  if (emojiMatch) {
    violations.push({ type: 'emoji', snippet: emojiMatch[0] });
  }

  const marketingMatch = MARKETING_RE.exec(text);
  if (marketingMatch) {
    violations.push({ type: 'marketing_tone', snippet: marketingMatch[0] });
  }

  return { ok: violations.length === 0, violations };
}
