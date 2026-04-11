'use client';

import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';

export default function CmdScene(): ReactElement {
  return (
    <div className="app">
      <TopBar context="Side Project MVP" right="none" />
      <div className="body" style={{ opacity: 0.5 }}>
        <aside className="sidebar collapsed" />
        <main className="main">
          <div className="msg-area">
            <div className="msg-col">
              <div className="msg-ai" style={{ color: 'var(--fg-2)' }}>
                I can feel it — you&apos;re circling the scope question again.
              </div>
              <div className="msg-ai" style={{ color: 'var(--fg-2)' }}>
                That&apos;s fine. Let&apos;s walk through it once more.
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="scrim">
        <div className="cmdbar">
          <div className="cmdbar-halo" />
          <div className="cmdbar-search">
            <span className="icon-btn" aria-hidden>
              ⌕
            </span>
            <input placeholder="" defaultValue="mvp" autoFocus />
            <div className="input-cursor" />
            <span className="kbd">ESC</span>
          </div>
          <div className="cmdbar-body">
            <div className="cmdbar-group">GOALS</div>
            <div className="cmdbar-row active">
              <span className="cmdbar-row-icon">
                <span className="dot active" />
              </span>
              <span className="cmdbar-row-text">Side Project MVP</span>
              <span className="cmdbar-row-meta">58%</span>
              <span className="kbd kbd-sm">⌘1</span>
            </div>
            <div className="cmdbar-row">
              <span className="cmdbar-row-icon">
                <span className="dot active" />
              </span>
              <span className="cmdbar-row-text">Daily 500 words</span>
              <span className="cmdbar-row-meta">80%</span>
              <span className="kbd kbd-sm">⌘2</span>
            </div>
            <div className="cmdbar-group">ACTIONS</div>
            <div className="cmdbar-row">
              <span className="cmdbar-row-icon">+</span>
              <span className="cmdbar-row-text">New goal</span>
              <span className="kbd kbd-sm">⌘N</span>
            </div>
            <div className="cmdbar-row">
              <span className="cmdbar-row-icon">↻</span>
              <span className="cmdbar-row-text">Weekly reflection</span>
              <span className="kbd kbd-sm">⌘R</span>
            </div>
            <div className="cmdbar-row">
              <span className="cmdbar-row-icon">→</span>
              <span className="cmdbar-row-text">Show full roadmap</span>
              <span className="kbd kbd-sm">⌘M</span>
            </div>
          </div>
          <div className="cmdbar-foot">
            <span className="cmdbar-foot-item">
              <strong>↑↓</strong> NAVIGATE
            </span>
            <span className="cmdbar-foot-item">
              <strong>↵</strong> SELECT
            </span>
            <span className="cmdbar-foot-item">
              <strong>ESC</strong> CLOSE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
