'use client';

import type { CSSProperties, ReactElement } from 'react';
import { useReducedMotion } from './reduced-motion';

interface AmbientHaloProps {
  size?: number;
  x?: number | string;
  y?: number | string;
  soft?: boolean;
  opacity?: number;
  style?: CSSProperties;
}

/**
 * Radial gradient halo with breathing animation.
 * Used in onboarding, empty state, lost-rebound, milestone complete.
 * When reduced-motion is active, opacity is fixed at 0.5 with no animation.
 */
export function AmbientHalo({
  size = 800,
  x = '50%',
  y = '50%',
  soft = false,
  opacity = 0.7,
  style,
}: AmbientHaloProps): ReactElement {
  const reduced = useReducedMotion();

  return (
    <div
      className={`halo ${soft ? 'halo-soft' : ''}`}
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        opacity: reduced ? 0.5 : opacity,
        animationPlayState: reduced ? 'paused' : 'running',
        ...style,
      }}
    />
  );
}
