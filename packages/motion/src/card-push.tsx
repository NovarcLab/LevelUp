'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useReducedMotion } from './reduced-motion';

interface CardPushProps {
  children: ReactNode;
  /** Skeleton delay before content appears (ms) */
  skeletonMs?: number;
}

/**
 * Card entry animation: skeleton placeholder → content push.
 * 0–200ms: skeleton bg-2 block
 * 200ms: content replaces skeleton, Y 12→0 + opacity 0→1 (280ms ease-out)
 */
export function CardPush({
  children,
  skeletonMs = 200,
}: CardPushProps): ReactElement {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setRevealed(true), skeletonMs);
    return () => clearTimeout(t);
  }, [reduced, skeletonMs]);

  if (!revealed) {
    return <div className="card-push-skeleton" />;
  }

  return (
    <div className={reduced ? '' : 'card-push-enter'}>
      {children}
    </div>
  );
}
