import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';
import Halo from '@/components/Halo';

export default function MilestoneScene(): ReactElement {
  return (
    <div className="app" style={{ position: 'relative' }}>
      <TopBar context="Side Project MVP" right="none" />
      <Halo size={1840} opacity={0.35} style={{ position: 'absolute', top: '-10%', left: '50%' }} />
      <div className="body-center">
        <div className="milestone-stage">
          <div className="milestone-card">
            <div className="milestone-card-head">
              <div className="dot active" />
              <span className="milestone-card-title">MVP document</span>
              <span className="milestone-card-pct">100%</span>
            </div>
            <div className="track">
              <div className="track-fill" style={{ width: '100%' }} />
            </div>
            <div className="milestone-card-tag">MILESTONE COMPLETE</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 520, maxWidth: '100%' }}>
            <div className="milestone-line dim">
              You said three weeks ago you might not make it.
            </div>
            <div className="milestone-line bright">You did.</div>
          </div>
        </div>
      </div>
      <div className="milestone-border" />
    </div>
  );
}
