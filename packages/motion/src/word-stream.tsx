'use client';

import { useMemo, type ReactElement } from 'react';
import { useReducedMotion } from './reduced-motion';

interface WordStreamProps {
  text: string;
  startDelay?: number;
  /** Gap between words in ms (default 60) */
  gap?: number;
  /** Extra pause after sentence-ending punctuation (default 240) */
  sentencePause?: number;
  className?: string;
}

/**
 * Splits text by words, animating each in with staggered timing.
 * 180ms fade+blur+Y per word, 60ms word gap, 240ms sentence pause.
 * When reduced-motion: renders all at once.
 */
export function WordStream({
  text,
  startDelay = 0,
  gap = 60,
  sentencePause = 240,
  className = '',
}: WordStreamProps): ReactElement {
  const reduced = useReducedMotion();
  const parts = useMemo(() => text.split(/(\s+)/), [text]);

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  let delay = startDelay;
  return (
    <span className={`word-stream ${className}`}>
      {parts.map((part, i) => {
        if (part.trim() === '') return <span key={i}>{part}</span>;
        const d = delay;
        delay += gap;
        if (/[.!?。！？]$/.test(part)) delay += sentencePause - gap;
        return (
          <span key={i} style={{ animationDelay: `${d}ms` }}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
