export interface MockMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface MockGoal {
  id: string;
  title: string;
  sub: string;
  percent: number;
  status: 'active' | 'idle' | 'stuck' | 'archived';
  current?: boolean;
  subAlert?: boolean;
}

export const MOCK_GOALS: MockGoal[] = [
  {
    id: 'g1',
    title: 'Side Project MVP',
    sub: 'Finish MVP document',
    percent: 58,
    status: 'active',
    current: true,
  },
  {
    id: 'g2',
    title: 'Daily 500 words',
    sub: '12 days streak',
    percent: 80,
    status: 'active',
  },
  {
    id: 'g3',
    title: 'Read 24 books',
    sub: 'Stalled · 16 days',
    percent: 12,
    status: 'stuck',
    subAlert: true,
  },
];

export const MOCK_CHAT_FRAME_5: MockMessage[] = [
  {
    id: 't1',
    role: 'assistant',
    content: 'Did you finish the PRD you mentioned yesterday?',
    timestamp: 'TUESDAY · 9:42 PM',
  },
  {
    id: 'u1',
    role: 'user',
    content: 'Got three sections in. Then got stuck on the scope part.',
  },
  {
    id: 'a2',
    role: 'assistant',
    content:
      'Where did you get stuck — was the scope unclear in your head, or were you just tired?',
  },
];

export const MOCK_CHAT_FRAME_6: MockMessage[] = [
  {
    id: 'a1',
    role: 'assistant',
    content: "Yesterday you said you'd write the scope section. How did it go?",
  },
  {
    id: 'u1',
    role: 'user',
    content:
      "Wrote it. Feels too ambitious though. I'm second-guessing the whole thing.",
  },
  {
    id: 'card',
    role: 'assistant',
    content: '__CARD__',
  },
  {
    id: 'a2',
    role: 'assistant',
    content:
      "The scope feeling too big usually means the next step isn't defined yet.\n\nWhat's the smallest version of this that still feels honest to you?",
  },
];
