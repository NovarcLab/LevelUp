'use client';

import { useMemo, type ReactElement } from 'react';

interface WordStreamProps {
  text: string;
  startDelay?: number;
  gap?: number;
  className?: string;
}

/**
 * Splits text by words and whitespace, animating each word in with the
 * ui.md §7.2 timing (180ms fade + blur + y-offset, 60ms word gap, 240ms
 * after sentence punctuation).
 */
export default function WordStream({
  text,
  startDelay = 0,
  gap = 60,
  className = '',
}: WordStreamProps): ReactElement {
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  let delay = startDelay;
  return (
    <span className={`word-stream ${className}`}>
      {parts.map((part, i) => {
        if (part.trim() === '') return <span key={i}>{part}</span>;
        const d = delay;
        delay += gap;
        if (/[.!?。！？]$/.test(part)) delay += 240 - gap;
        return (
          <span key={i} style={{ animationDelay: `${d}ms` }}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
