'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { Command } from 'cmdk';
import { useKeyboard } from '@/lib/keyboard';
import { CommandBarRise } from '@levelup/motion';
import { MOCK_GOALS } from '@/lib/mock';

interface CommandAction {
  id: string;
  label: string;
  icon: string;
  kbd?: string;
}

const ACTIONS: CommandAction[] = [
  { id: 'new-goal', label: 'New goal', icon: '+', kbd: '⌘N' },
  { id: 'retro', label: 'Weekly reflection', icon: '↻', kbd: '⌘R' },
  { id: 'roadmap', label: 'Show full roadmap', icon: '→', kbd: '⌘M' },
  { id: 'archive', label: 'Archive current goal', icon: '⌫' },
];

export default function CommandBar(): ReactElement {
  const { commandBarOpen, setCommandBarOpen } = useKeyboard();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandBarOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandBarOpen]);

  function handleSelect(id: string) {
    setCommandBarOpen(false);
    // Actions will be wired to real handlers when backend is connected
    console.log('[CommandBar] selected:', id);
  }

  return (
    <CommandBarRise open={commandBarOpen}>
      <div className="scrim" onClick={() => setCommandBarOpen(false)}>
        <div className="cmdbar" onClick={(e) => e.stopPropagation()}>
          <div className="cmdbar-halo" />
          <Command shouldFilter label="Command Bar">
            <div className="cmdbar-search">
              <span className="icon-btn" aria-hidden>⌕</span>
              <Command.Input
                ref={inputRef}
                placeholder=""
                className="cmdbar-input"
              />
              <span className="kbd">ESC</span>
            </div>
            <Command.List>
              <div className="cmdbar-body">
                <Command.Empty>
                  <div className="cmdbar-empty">No results</div>
                </Command.Empty>

                <Command.Group heading="GOALS">
                  {MOCK_GOALS.map((g, i) => (
                    <Command.Item
                      key={g.id}
                      value={g.title}
                      onSelect={() => handleSelect(g.id)}
                      className="cmdbar-row"
                    >
                      <span className="cmdbar-row-icon">
                        <span className={`dot ${g.status}`} />
                      </span>
                      <span className="cmdbar-row-text">{g.title}</span>
                      <span className="cmdbar-row-meta">{g.percent}%</span>
                      <span className="kbd kbd-sm">⌘{i + 1}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="ACTIONS">
                  {ACTIONS.map((a) => (
                    <Command.Item
                      key={a.id}
                      value={a.label}
                      onSelect={() => handleSelect(a.id)}
                      className="cmdbar-row"
                    >
                      <span className="cmdbar-row-icon">{a.icon}</span>
                      <span className="cmdbar-row-text">{a.label}</span>
                      {a.kbd && <span className="kbd kbd-sm">{a.kbd}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              </div>
            </Command.List>
          </Command>
          <div className="cmdbar-foot">
            <span className="cmdbar-foot-item"><strong>↑↓</strong> NAVIGATE</span>
            <span className="cmdbar-foot-item"><strong>↵</strong> SELECT</span>
            <span className="cmdbar-foot-item"><strong>ESC</strong> CLOSE</span>
          </div>
        </div>
      </div>
    </CommandBarRise>
  );
}
