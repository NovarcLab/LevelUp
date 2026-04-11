import type { TenantContext } from '@levelup/tenancy';
import {
  SoulFrontmatterSchema,
  type Intent,
  type PersonaSignal,
  type Soul,
  type SoulDimensions,
} from '@levelup/shared';
import { parseFrontmatter, stringifyFrontmatter } from '@levelup/memory';
import { BASE_SOUL } from './base-soul.js';
import { describeDimensions } from './tone-bands.js';

const SOUL_PATH = 'SOUL.md';

export const personaEngine = {
  /** Write the baseline SOUL.md. Called by tenancy.provision via auth. */
  async initSoul(ctx: TenantContext): Promise<Soul> {
    const existing = await ctx.workspace.readTextOrNull(SOUL_PATH);
    if (existing) return personaEngine.loadSoul(ctx);
    const soul: Soul = {
      frontmatter: SoulFrontmatterSchema.parse(BASE_SOUL.frontmatter),
      aboutMd: BASE_SOUL.body,
    };
    await writeSoul(ctx, soul);
    return soul;
  },

  async loadSoul(ctx: TenantContext): Promise<Soul> {
    const raw = (await ctx.workspace.readTextOrNull(SOUL_PATH)) ?? '';
    if (!raw) return personaEngine.initSoul(ctx);
    const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(raw, {});
    const parsed = SoulFrontmatterSchema.parse(frontmatter);
    return { frontmatter: parsed, aboutMd: body };
  },

  async manualSet(
    ctx: TenantContext,
    patch: Partial<SoulDimensions>,
  ): Promise<Soul> {
    const soul = await personaEngine.loadSoul(ctx);
    const next: Soul = {
      frontmatter: SoulFrontmatterSchema.parse({
        ...soul.frontmatter,
        warmth: patch.warmth !== undefined ? clamp(patch.warmth) : soul.frontmatter.warmth,
        directness:
          patch.directness !== undefined ? clamp(patch.directness) : soul.frontmatter.directness,
        pacing: patch.pacing !== undefined ? clamp(patch.pacing) : soul.frontmatter.pacing,
        lastCalibrated: new Date().toISOString(),
      }),
      aboutMd: soul.aboutMd,
    };
    await writeSoul(ctx, next);
    return next;
  },

  async calibrate(ctx: TenantContext, signal: PersonaSignal): Promise<Soul> {
    const soul = await personaEngine.loadSoul(ctx);
    const delta = deltaFor(signal);
    if (!delta) return soul;

    const next: Soul = {
      frontmatter: SoulFrontmatterSchema.parse({
        ...soul.frontmatter,
        warmth: clamp(soul.frontmatter.warmth + (delta.warmth ?? 0)),
        directness: clamp(soul.frontmatter.directness + (delta.directness ?? 0)),
        pacing: clamp(soul.frontmatter.pacing + (delta.pacing ?? 0)),
        lastCalibrated: new Date().toISOString(),
        calibrationLog: [
          ...soul.frontmatter.calibrationLog.slice(-49),
          { at: new Date().toISOString(), delta, reason: describeSignal(signal) },
        ],
      }),
      aboutMd: soul.aboutMd,
    };
    await writeSoul(ctx, next);
    return next;
  },

  buildSystemPrompt(
    soul: Soul,
    hint: { intent?: Intent; openingHint?: 'continue' | 'reopen' | 'reconnect' | 'new_user' } = {},
  ): string {
    const dims = effectiveDims(soul.frontmatter, hint.intent);
    const sections = [
      `# Identity`,
      `You are the user's growth companion. Not an assistant, not a coach, not a character. You are someone who has walked a stretch of the road with them.`,
      '',
      `# Tone dials (right now)`,
      describeDimensions(dims),
      '',
      `# Hard boundaries`,
      `- No medical, legal, or financial advice.`,
      `- No judgment of values.`,
      `- No promises of outcome. Only companionship.`,
      '',
      `# Forbidden openings`,
      `Never begin a reply with any of: "Sure,", "Of course,", "Certainly,", "As an AI", "当然可以", "好问题", "希望对你有帮助", "让我们一起". No emojis. No marketing language.`,
      '',
      `# Forbidden mid-reply phrases`,
      `Never use: "太棒了", "继续加油", "加油", "你真的很棒", "相信你一定可以".`,
      '',
      `# Notes about this user`,
      soul.aboutMd.trim(),
    ];

    if (hint.intent) sections.push('', `# Intent this turn`, `The user's message is classified as: ${hint.intent}.`);
    if (hint.openingHint && hint.openingHint !== 'new_user') {
      sections.push('', `# Opening stance`, openingCue(hint.openingHint));
    }

    return sections.join('\n');
  },
};

async function writeSoul(ctx: TenantContext, soul: Soul): Promise<void> {
  const doc = stringifyFrontmatter({ frontmatter: soul.frontmatter, body: soul.aboutMd });
  await ctx.workspace.writeTextAtomic(SOUL_PATH, doc);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deltaFor(signal: PersonaSignal): Partial<SoulDimensions> | null {
  switch (signal.type) {
    case 'emotion_word':
      return signal.intensity >= 0.6 ? { warmth: 3, pacing: 5 } : null;
    case 'long_silence':
      return signal.days >= 7 ? { warmth: 5, directness: -5 } : null;
    case 'user_pushback':
      return { warmth: -8 };
    case 'user_warmth_request':
      return { warmth: 8, pacing: 3 };
    case 'missed_action_streak':
      return signal.count >= 3 ? { directness: 5 } : null;
  }
}

function describeSignal(signal: PersonaSignal): string {
  switch (signal.type) {
    case 'emotion_word':
      return `emotion word "${signal.word}" intensity ${signal.intensity}`;
    case 'long_silence':
      return `silent for ${signal.days} days`;
    case 'user_pushback':
      return `pushback: ${signal.phrase}`;
    case 'user_warmth_request':
      return `warmth request: ${signal.phrase}`;
    case 'missed_action_streak':
      return `missed ${signal.count} actions in a row`;
  }
}

function effectiveDims(
  base: SoulDimensions,
  intent: Intent | undefined,
): SoulDimensions {
  if (!intent) return base;
  switch (intent) {
    case 'emotion':
      return {
        warmth: clamp(base.warmth + 10),
        directness: base.directness,
        pacing: clamp(base.pacing + 15),
      };
    case 'retro_request':
      return {
        warmth: base.warmth,
        directness: clamp(base.directness + 10),
        pacing: base.pacing,
      };
    default:
      return base;
  }
}

function openingCue(hint: 'continue' | 'reopen' | 'reconnect'): string {
  switch (hint) {
    case 'continue':
      return 'You were mid-conversation recently. Pick up where you left off. No greeting.';
    case 'reopen':
      return 'You last spoke a few days ago. Reference the unresolved question naturally. No restart.';
    case 'reconnect':
      return 'It has been over a week. Be steady and unhurried. No guilt, no theater. Ask one thing, small.';
  }
}
