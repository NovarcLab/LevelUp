'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

/* ── Types ─────────────────────────────────────────── */

export interface Shortcut {
  /** Display label, e.g. "⌘K" */
  label: string;
  /** Match predicate */
  match: (e: KeyboardEvent) => boolean;
  /** Handler — return true to stop propagation */
  handler: () => boolean | void;
  /** Priority: higher wins when multiple match (default 0) */
  priority?: number;
  /** Only active when input is NOT focused */
  globalOnly?: boolean;
}

interface KeyboardCtx {
  registerShortcut: (id: string, shortcut: Shortcut) => () => void;
  commandBarOpen: boolean;
  setCommandBarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
}

const Ctx = createContext<KeyboardCtx>(null!);

/* ── Helpers ───────────────────────────────────────── */

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const mod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey);

export const shortcuts = {
  commandBar: (e: KeyboardEvent) => mod(e) && e.key === 'k',
  sidebar: (e: KeyboardEvent) => mod(e) && e.key === 'b',
  commandPalette: (e: KeyboardEvent) => mod(e) && e.key === '/',
  send: (e: KeyboardEvent) => mod(e) && e.key === 'Enter',
  escape: (e: KeyboardEvent) => e.key === 'Escape',
};

/* ── Provider ──────────────────────────────────────── */

export function KeyboardProvider({ children }: { children: ReactNode }): ReactElement {
  const registered = useRef(new Map<string, Shortcut>());
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === '1';
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  const registerShortcut = useCallback((id: string, shortcut: Shortcut) => {
    registered.current.set(id, shortcut);
    return () => { registered.current.delete(id); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      // Collect matching shortcuts
      const matches: Shortcut[] = [];
      for (const shortcut of registered.current.values()) {
        if (shortcut.globalOnly && isInput) continue;
        if (shortcut.match(e)) matches.push(shortcut);
      }

      // Sort by priority (higher first)
      matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const s of matches) {
        const stop = s.handler();
        if (stop !== false) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const ctx = useMemo(
    () => ({
      registerShortcut,
      commandBarOpen,
      setCommandBarOpen,
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
    }),
    [registerShortcut, commandBarOpen, sidebarCollapsed, toggleSidebar],
  );

  return <Ctx value={ctx}>{children}</Ctx>;
}

/* ── Hooks ─────────────────────────────────────────── */

export function useKeyboard() {
  return useContext(Ctx);
}

/**
 * Register a keyboard shortcut that auto-cleans up on unmount.
 */
export function useShortcut(id: string, shortcut: Shortcut) {
  const { registerShortcut } = useKeyboard();
  useEffect(() => registerShortcut(id, shortcut), [id, shortcut, registerShortcut]);
}

/**
 * Register all built-in global shortcuts.
 * Call once in the root layout or app shell.
 */
export function useGlobalShortcuts() {
  const { setCommandBarOpen, toggleSidebar, commandBarOpen } = useKeyboard();

  useShortcut('toggle-command-bar', useMemo(() => ({
    label: '⌘K',
    match: shortcuts.commandBar,
    handler: () => { setCommandBarOpen(!commandBarOpen); },
    priority: 100,
  }), [setCommandBarOpen, commandBarOpen]));

  useShortcut('toggle-sidebar', useMemo(() => ({
    label: '⌘B',
    match: shortcuts.sidebar,
    handler: () => { toggleSidebar(); },
    priority: 100,
    globalOnly: true,
  }), [toggleSidebar]));

  useShortcut('escape', useMemo(() => ({
    label: 'Esc',
    match: shortcuts.escape,
    handler: () => {
      if (commandBarOpen) {
        setCommandBarOpen(false);
        return true;
      }
      return false;
    },
    priority: 200,
  }), [commandBarOpen, setCommandBarOpen]));
}
