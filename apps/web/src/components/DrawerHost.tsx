'use client';

import { useEffect, type ReactElement } from 'react';
import { useDrawer } from '@/lib/drawer';
import { useShortcut } from '@/lib/keyboard';
import { MOCK_GOALS } from '@/lib/mock';

/* ── Mock data for the drawer (until backend connection) ─── */

const MOCK_MILESTONES = [
  { id: 'm1', title: 'Discovery', status: 'done', meta: 'DONE · MAR 18' },
  { id: 'm2', title: 'MVP document', status: 'active', meta: 'IN PROGRESS · 58%', current: true },
  { id: 'm3', title: 'Ship to 5 users', status: 'idle', meta: 'WEEK 7' },
  { id: 'm4', title: 'Iterate', status: 'idle', meta: 'WEEK 9' },
];

const MOCK_INTENTION = {
  text: `When it's 9pm and I sit at my desk,\nI'll open the MVP doc and fill the scope section,\nuntil the 25-min timer runs out.`,
  stats: '7-DAY RUN · 5 KEPT',
};

/* ── Component ─────────────────────────────────────── */

export default function DrawerHost(): ReactElement {
  const { current, close } = useDrawer();

  // Close drawer on Escape
  useShortcut('drawer-escape', {
    label: 'Esc',
    match: (e) => e.key === 'Escape',
    handler: () => {
      if (current) {
        close();
        return true;
      }
      return false;
    },
    priority: 150,
  });

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (current) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [current]);

  if (!current) return <></>;

  if (current.type === 'goal') {
    const goal = MOCK_GOALS.find((g) => g.id === current.goalId);
    if (!goal) return <></>;

    return (
      <div className="drawer-scrim" onClick={close}>
        <div className="drawer" onClick={(e) => e.stopPropagation()}>
          <div className="drawer-head">
            <div className="drawer-head-left">
              <div className="drawer-head-dot" />
              <div className="drawer-title">{goal.title}</div>
            </div>
            <button className="icon-btn" onClick={close}>×</button>
          </div>
          <div className="drawer-body">
            <section className="drawer-section">
              <div className="drawer-prog">
                <div className="drawer-section-label">PROGRESS</div>
                <div className="drawer-prog-num">{goal.percent}%</div>
              </div>
              <div className="track">
                <div className="track-fill" style={{ width: `${goal.percent}%` }} />
              </div>
              <div className="drawer-meta">
                <span>Started Mar 4</span>
                <span>38 days in · 27 days left</span>
              </div>
            </section>

            <section className="drawer-section">
              <div className="drawer-section-label">PATH</div>
              {MOCK_MILESTONES.map((m) => (
                <div key={m.id} className={`tree-node ${m.current ? 'current' : ''}`}>
                  <div className={`dot ${m.status === 'done' ? 'active' : m.status}`} style={{ marginTop: 6 }} />
                  <div className="tree-node-col">
                    <div className={`tree-node-title ${m.status === 'idle' ? 'dim' : ''}`}>{m.title}</div>
                    <div className={`tree-node-meta ${m.current ? 'accent' : ''}`}>{m.meta}</div>
                  </div>
                </div>
              ))}
            </section>

            <section>
              <div className="intent-card">
                <div className="drawer-section-label">IMPLEMENTATION INTENTION</div>
                <div className="intent-text">{MOCK_INTENTION.text}</div>
                <div className="intent-meta">
                  <span className="intent-meta-l">{MOCK_INTENTION.stats}</span>
                  <span className="intent-meta-r">EDIT</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // Roadmap drawer placeholder
  return (
    <div className="drawer-scrim" onClick={close}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-head-left">
            <div className="drawer-title">Roadmap</div>
          </div>
          <button className="icon-btn" onClick={close}>×</button>
        </div>
        <div className="drawer-body">
          <div style={{ padding: 24, color: 'var(--fg-2)' }}>Roadmap view coming soon</div>
        </div>
      </div>
    </div>
  );
}
