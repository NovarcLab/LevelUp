import type { ReactElement, CSSProperties } from 'react';

interface HaloProps {
  size?: number;
  x?: number | string;
  y?: number | string;
  soft?: boolean;
  opacity?: number;
  style?: CSSProperties;
}

/**
 * Ambient halo — radial gradient, breathing animation. Used in onboarding,
 * empty state, lost & rebound, milestone complete.
 */
export default function Halo({
  size = 800,
  x = '50%',
  y = '50%',
  soft = false,
  opacity = 0.7,
  style,
}: HaloProps): ReactElement {
  return (
    <div
      className={`halo ${soft ? 'halo-soft' : ''}`}
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        opacity,
        ...style,
      }}
    />
  );
}
