import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';

export default function DrawerScene(): ReactElement {
  return (
    <div className="app">
      <TopBar context="Side Project MVP" right="none" />
      <div className="body">
        <main className="main" style={{ opacity: 0.4 }}>
          <div className="msg-area">
            <div className="msg-col">
              <div className="msg-ai" style={{ color: 'var(--fg-2)' }}>
                Show me the path.
              </div>
            </div>
          </div>
        </main>
      </div>
      <div className="drawer-scrim" style={{ position: 'absolute' }}>
        <div className="drawer">
          <div className="drawer-head">
            <div className="drawer-head-left">
              <div className="drawer-head-dot" />
              <div className="drawer-title">Side Project MVP</div>
            </div>
            <div className="icon-btn">×</div>
          </div>
          <div className="drawer-body">
            <section className="drawer-section">
              <div className="drawer-prog">
                <div className="drawer-section-label">PROGRESS</div>
                <div className="drawer-prog-num">58%</div>
              </div>
              <div className="track">
                <div className="track-fill" style={{ width: '58%' }} />
              </div>
              <div className="drawer-meta">
                <span>Started Mar 4</span>
                <span>38 days in · 27 days left</span>
              </div>
            </section>

            <section className="drawer-section">
              <div className="drawer-section-label">PATH</div>
              <div className="tree-node">
                <div className="dot active" style={{ marginTop: 6 }} />
                <div className="tree-node-col">
                  <div className="tree-node-title">Discovery</div>
                  <div className="tree-node-meta">DONE · MAR 18</div>
                </div>
              </div>
              <div className="tree-node current">
                <div className="dot active" style={{ marginTop: 6 }} />
                <div className="tree-node-col">
                  <div className="tree-node-title">MVP document</div>
                  <div className="tree-node-meta accent">IN PROGRESS · 58%</div>
                </div>
              </div>
              <div className="tree-node">
                <div className="dot idle" style={{ marginTop: 6 }} />
                <div className="tree-node-col">
                  <div className="tree-node-title dim">Ship to 5 users</div>
                  <div className="tree-node-meta">WEEK 7</div>
                </div>
              </div>
              <div className="tree-node">
                <div className="dot idle" style={{ marginTop: 6 }} />
                <div className="tree-node-col">
                  <div className="tree-node-title dim">Iterate</div>
                  <div className="tree-node-meta">WEEK 9</div>
                </div>
              </div>
            </section>

            <section>
              <div className="intent-card">
                <div className="drawer-section-label">IMPLEMENTATION INTENTION</div>
                <div className="intent-text">{`When it's 9pm and I sit at my desk,
I'll open the MVP doc and fill the scope section,
until the 25-min timer runs out.`}</div>
                <div className="intent-meta">
                  <span className="intent-meta-l">7-DAY RUN · 5 KEPT</span>
                  <span className="intent-meta-r">EDIT</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
