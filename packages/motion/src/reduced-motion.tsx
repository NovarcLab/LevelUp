'use client';

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const query = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

const Ctx = createContext(false);

export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <Ctx value={reduced}>{children}</Ctx>;
}

export function useReducedMotion(): boolean {
  return useContext(Ctx);
}
