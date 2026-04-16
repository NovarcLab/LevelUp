import type { LLMClient } from '@levelup/llm';

export interface IIDraft {
  trigger: string;
  behavior: string;
  termination: string;
  fallback?: string;
}

export interface ValidationIssue {
  field: 'trigger' | 'behavior' | 'termination' | 'fallback';
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

/** Quick rule-based pre-check before LLM validation. */
function ruleCheck(draft: IIDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Trigger must be specific
  const vagueTriggersRe = /^(有空|想到|sometime|whenever|if i feel like)/i;
  if (vagueTriggersRe.test(draft.trigger.trim())) {
    issues.push({
      field: 'trigger',
      reason: 'Trigger too vague — needs a specific time, place, event, or emotion signal',
    });
  }

  // Behavior must start with a verb
  const firstWord = draft.behavior.trim().split(/\s+/)[0] ?? '';
  const commonNonVerbs = ['i', 'my', 'the', 'a', 'an', 'it', 'writing', 'reading'];
  if (commonNonVerbs.includes(firstWord.toLowerCase())) {
    issues.push({
      field: 'behavior',
      reason: 'Behavior should start with an action verb (e.g., "open", "write", "call")',
    });
  }

  // Termination must be observable
  const vagueTermRe = /^(感觉|feel|done|finished|完成|够了)/i;
  if (vagueTermRe.test(draft.termination.trim())) {
    issues.push({
      field: 'termination',
      reason: 'Termination must be observable (duration, page count, section completed)',
    });
  }

  // Fallback gets the same treatment if present
  if (draft.fallback && vagueTriggersRe.test(draft.fallback.trim())) {
    issues.push({
      field: 'fallback',
      reason: 'Fallback trigger too vague — needs a specific alternative time/event',
    });
  }

  return issues;
}

/**
 * Validate an implementation intention draft using rules + LLM.
 * If rules pass, LLM provides deeper semantic check.
 */
export async function validateII(
  draft: IIDraft,
  llm: LLMClient,
): Promise<ValidationResult> {
  // Phase 1: rule-based check
  const ruleIssues = ruleCheck(draft);
  if (ruleIssues.length > 0) {
    return { ok: false, issues: ruleIssues };
  }

  // Phase 2: LLM semantic check
  const prompt = `Check this implementation intention for quality:
Trigger: "${draft.trigger}"
Behavior: "${draft.behavior}"
Termination: "${draft.termination}"
${draft.fallback ? `Fallback: "${draft.fallback}"` : ''}

Rules:
1. Trigger must reference a recognizable external/internal signal (time, place, event, emotion)
2. Behavior must start with an action verb and be startable within 5 minutes
3. Termination must be observable (not "feel done")
4. Each should be specific, not abstract

Respond ONLY with JSON: {"ok":true} or {"ok":false,"issues":[{"field":"trigger|behavior|termination","reason":"..."}]}`;

  let response = '';
  for await (const ev of llm.stream({
    systemPrompt: 'You validate implementation intentions. Respond only in JSON.',
    messages: [{ role: 'user', content: prompt }],
  })) {
    if (ev.type === 'token') response += ev.text;
  }

  try {
    const parsed = JSON.parse(response) as { ok: boolean; issues?: ValidationIssue[] };
    return {
      ok: parsed.ok,
      issues: parsed.issues ?? [],
    };
  } catch {
    // LLM failed to produce valid JSON — pass through
    return { ok: true, issues: [] };
  }
}

/**
 * Ask the LLM to rewrite a draft that failed validation.
 * Max 2 retries.
 */
export async function rewriteII(
  draft: IIDraft,
  issues: ValidationIssue[],
  llm: LLMClient,
): Promise<IIDraft> {
  const prompt = `This implementation intention has issues:
Trigger: "${draft.trigger}"
Behavior: "${draft.behavior}"
Termination: "${draft.termination}"
${draft.fallback ? `Fallback: "${draft.fallback}"` : ''}

Issues:
${issues.map((i) => `- ${i.field}: ${i.reason}`).join('\n')}

Rewrite to fix the issues while keeping the original intent.
Respond ONLY with JSON: {"trigger":"...","behavior":"...","termination":"...","fallback":"..."}`;

  let response = '';
  for await (const ev of llm.stream({
    systemPrompt: 'You rewrite implementation intentions. Respond only in JSON.',
    messages: [{ role: 'user', content: prompt }],
  })) {
    if (ev.type === 'token') response += ev.text;
  }

  try {
    return JSON.parse(response) as IIDraft;
  } catch {
    return draft; // fallback to original
  }
}
