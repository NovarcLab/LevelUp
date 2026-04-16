/** Motion timing and easing tokens — mirrors globals.css §Motion */

export const duration = {
  fast: 120,
  base: 200,
  mid: 320,
  slow: 480,
  breath: 6000,
} as const;

export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.7, 0, 0.84, 0] as const,
  io: [0.87, 0, 0.13, 1] as const,
  spring: [0.5, 1.3, 0.5, 1] as const,
};

export const cssEase = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  in: 'cubic-bezier(0.7, 0, 0.84, 0)',
  io: 'cubic-bezier(0.87, 0, 0.13, 1)',
} as const;
