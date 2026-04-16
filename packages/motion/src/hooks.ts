'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from './reduced-motion';

/**
 * Hover underline animation: width 0→100% from left.
 * Attach to an anchor/link element.
 */
export function useUnderlineFromLeft(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    el.style.setProperty('--underline-scale', '0');
    el.style.backgroundImage = 'linear-gradient(currentColor, currentColor)';
    el.style.backgroundSize = 'var(--underline-scale, 0) 1px';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'left bottom';
    el.style.transition = '--underline-scale 200ms cubic-bezier(0.16, 1, 0.3, 1)';

    const enter = () => el.style.setProperty('--underline-scale', '100%');
    const leave = () => el.style.setProperty('--underline-scale', '0');

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    };
  }, [ref, reduced]);
}

/**
 * Card hover: translateY -2px on hover.
 */
export function useCardHoverLift(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    el.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';

    const enter = () => { el.style.transform = 'translateY(-2px)'; };
    const leave = () => { el.style.transform = 'translateY(0)'; };

    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    };
  }, [ref, reduced]);
}

/**
 * Animated number counter with tabular-nums, 600ms transition.
 */
export function useCounterRoll(value: number): RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const prevRef = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || prevRef.current === value) {
      if (el) el.textContent = String(value);
      prevRef.current = value;
      return;
    }

    const start = prevRef.current;
    const diff = value - start;
    const durationMs = 600;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = Math.round(start + diff * eased);
      if (el) el.textContent = String(current);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    prevRef.current = value;
  }, [value, reduced]);

  return ref;
}

/**
 * Input focus: bottom-line accent transition.
 */
export function useFocusBottomLine(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const focus = () => el.classList.add('bottom-line-focus');
    const blur = () => el.classList.remove('bottom-line-focus');

    el.addEventListener('focus', focus, true);
    el.addEventListener('blur', blur, true);
    return () => {
      el.removeEventListener('focus', focus, true);
      el.removeEventListener('blur', blur, true);
    };
  }, [ref, reduced]);
}
