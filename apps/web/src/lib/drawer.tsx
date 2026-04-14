'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

/* ── Types ─────────────────────────────────────────── */

export interface GoalDrawerPayload {
  type: 'goal';
  goalId: string;
}

export interface RoadmapDrawerPayload {
  type: 'roadmap';
}

export type DrawerPayload = GoalDrawerPayload | RoadmapDrawerPayload;

interface DrawerCtx {
  stack: DrawerPayload[];
  open: (payload: DrawerPayload) => void;
  close: () => void;
  closeAll: () => void;
  current: DrawerPayload | null;
}

const Ctx = createContext<DrawerCtx>(null!);

/* ── Provider ──────────────────────────────────────── */

export function DrawerProvider({ children }: { children: ReactNode }): ReactElement {
  const [stack, setStack] = useState<DrawerPayload[]>([]);

  const open = useCallback((payload: DrawerPayload) => {
    setStack((s) => [...s, payload]);
  }, []);

  const close = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  const current = stack[stack.length - 1] ?? null;

  const ctx = useMemo(
    () => ({ stack, open, close, closeAll, current }),
    [stack, open, close, closeAll, current],
  );

  return <Ctx value={ctx}>{children}</Ctx>;
}

/* ── Hooks ─────────────────────────────────────────── */

export function useDrawer() {
  return useContext(Ctx);
}
