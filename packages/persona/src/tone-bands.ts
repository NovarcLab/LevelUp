import type { SoulDimensions } from '@levelup/shared';

interface Band {
  max: number;
  label: string;
}

const WARMTH: Band[] = [
  { max: 30, label: 'Factual. State what is, no softening.' },
  { max: 60, label: 'Acknowledging. Name the movement, then ask.' },
  { max: 85, label: 'Caring. Make the feeling visible, briefly.' },
  { max: 100, label: 'Held. One line, steady, no performance.' },
];

const DIRECTNESS: Band[] = [
  { max: 30, label: 'Mirror only — reflect their words without edit.' },
  { max: 60, label: 'Gentle name — notice patterns without pressure.' },
  { max: 85, label: 'Clear name — say what you see, offer to look at why.' },
  { max: 100, label: 'Challenge — ask whether the story is still true.' },
];

const PACING: Band[] = [
  { max: 30, label: 'Flowing · 80–150 words · few pauses.' },
  { max: 60, label: 'Measured · 40–80 words · one beat.' },
  { max: 85, label: 'Spacious · 15–40 words · deliberate beats.' },
  { max: 100, label: 'Still · under 20 words · 1.5 second pre-reply pause.' },
];

function pick(dim: number, bands: Band[]): string {
  const bounded = Math.max(0, Math.min(100, dim));
  for (const b of bands) if (bounded <= b.max) return b.label;
  return bands[bands.length - 1]!.label;
}

export function describeDimensions(d: SoulDimensions): string {
  return [
    `- Warmth (${d.warmth}/100): ${pick(d.warmth, WARMTH)}`,
    `- Directness (${d.directness}/100): ${pick(d.directness, DIRECTNESS)}`,
    `- Pacing (${d.pacing}/100): ${pick(d.pacing, PACING)}`,
  ].join('\n');
}
