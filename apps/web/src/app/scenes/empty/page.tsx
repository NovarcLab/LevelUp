import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';
import Halo from '@/components/Halo';

export default function EmptyScene(): ReactElement {
  return (
    <div className="app">
      <TopBar right="none" />
      <div className="body">
        <aside className="sidebar collapsed">
          <span className="sb-add" aria-hidden>
            +
          </span>
        </aside>
        <main className="body-center">
          <Halo size={440} opacity={0.5} />
          <div className="empty">
            <div className="dot active" style={{ marginBottom: 0 }} />
            <div className="empty-title">Start talking.</div>
            <div className="empty-sub">I&apos;ll remember what you say.</div>
            <div className="empty-kbd-row">
              <span className="kbd">⌘N</span>
              <span className="empty-sub">to open</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
