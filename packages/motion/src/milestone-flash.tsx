'use client';

import { useCallback, type RefObject } from 'react';
import { animate } from 'motion';
import { useReducedMotion } from './reduced-motion';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Milestone celebration sequence (ui.md §7.7):
 * 1. Card scale 1→1.01 (280ms)
 * 2. Pause 200ms
 * 3. Screen-edge 1px accent ring
 * 4. Pause 200ms
 * 5. Status dot → accent color
 * 6. Pause 200ms
 * 7. Inline label "MILESTONE COMPLETE"
 * 8. Pause 600ms
 * 9. Card scale back to 1 (300ms)
 * 10. Hold 1500ms
 */
export function useMilestoneFlash(cardRef: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();

  return useCallback(async () => {
    const el = cardRef.current;
    if (!el || reduced) return;

    // Scale up
    await animate(el, { scale: 1.01 }, { duration: 0.28, ease: [0.16, 1, 0.3, 1] });
    await delay(200);

    // Screen ring — add temporary border
    const ring = document.createElement('div');
    ring.className = 'milestone-ring';
    document.body.appendChild(ring);
    await animate(ring, { opacity: [0, 1, 0] }, { duration: 0.6 });
    ring.remove();
    await delay(200);

    // Dot color flash — dispatched as custom event for the sidebar to pick up
    el.dispatchEvent(new CustomEvent('milestone:dot', { bubbles: true }));
    await delay(200);

    // Inline label
    const label = document.createElement('div');
    label.className = 'milestone-label';
    label.textContent = 'MILESTONE COMPLETE';
    el.appendChild(label);
    await animate(label, { opacity: [0, 1] }, { duration: 0.2 });
    await delay(600);

    // Scale back
    await animate(el, { scale: 1 }, { duration: 0.3 });

    // Hold
    await delay(1500);
    label.remove();
  }, [cardRef, reduced]);
}
