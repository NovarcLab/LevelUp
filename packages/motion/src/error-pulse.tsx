'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useReducedMotion } from './reduced-motion';

interface ErrorPulseProps {
  active: boolean;
  caption?: string;
  /** Auto-dismiss caption after ms (default 3000) */
  dismissMs?: number;
  children: ReactNode;
}

/**
 * Error state: bottom-line pulses line-1→signal→line-1 (1000ms ease-io).
 * Caption fades out after 3s.
 */
export function ErrorPulse({
  active,
  caption,
  dismissMs = 3000,
  children,
}: ErrorPulseProps): ReactElement {
  const reduced = useReducedMotion();
  const [showCaption, setShowCaption] = useState(false);

  useEffect(() => {
    if (!active || !caption) {
      setShowCaption(false);
      return;
    }
    setShowCaption(true);
    const t = setTimeout(() => setShowCaption(false), dismissMs);
    return () => clearTimeout(t);
  }, [active, caption, dismissMs]);

  return (
    <div className={active && !reduced ? 'error-pulse-active' : ''}>
      {children}
      {showCaption && caption && (
        <div className="error-pulse-caption">{caption}</div>
      )}
    </div>
  );
}
