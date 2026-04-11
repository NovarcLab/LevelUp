import type { Intent } from '@levelup/shared';

interface Rule {
  intent: Intent;
  patterns: RegExp[];
}

/**
 * Cheap rule-based intent classifier. Matches on the user's message; callers
 * can still override with an explicit intent. Falls back to small_talk.
 */
const RULES: Rule[] = [
  {
    intent: 'progress_report',
    patterns: [
      /\b(done|finished|completed|shipped)\b/i,
      /写(完|了)/,
      /做(完|到)了/,
      /完成了/,
    ],
  },
  {
    intent: 'emotion',
    patterns: [
      /\b(tired|exhausted|stuck|lost|overwhelmed|give up|want to quit)\b/i,
      /累了?/,
      /迷茫/,
      /不想(做|动)/,
      /想放弃/,
    ],
  },
  {
    intent: 'goal_query',
    patterns: [
      /\b(what should i|where am i|next step|what's next)\b/i,
      /我(现在)?该(做什么|怎么办)/,
      /下一步/,
    ],
  },
  {
    intent: 'new_goal',
    patterns: [
      /\b(new goal|start a|want to start)\b/i,
      /(新|开始一个)目标/,
      /我想开始/,
    ],
  },
  {
    intent: 'retro_request',
    patterns: [
      /\b(retro|review|reflect|recap|summary)\b/i,
      /复盘/,
      /总结一下/,
    ],
  },
  {
    intent: 'goal_adjust',
    patterns: [
      /\b(change|adjust|modify|drop|quit) (this|the) goal\b/i,
      /想(改|调整|放弃)/,
      /不想(做|继续)(这个目标)?/,
    ],
  },
];

export function classifyIntent(userMessage: string): Intent {
  const text = userMessage.trim();
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      if (re.test(text)) return rule.intent;
    }
  }
  return 'small_talk';
}
