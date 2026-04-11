import type { ReactElement } from 'react';

interface InlineCardProps {
  title: string;
  percent: number;
  current: string;
  next: string;
  cta?: string;
}

export default function InlineCard({
  title,
  percent,
  current,
  next,
  cta = 'VIEW FULL PATH',
}: InlineCardProps): ReactElement {
  return (
    <div className="inline-card">
      <div className="inline-card-head">
        <div className="dot active" />
        <span className="inline-card-title">{title}</span>
        <div className="inline-card-spacer" />
        <span className="inline-card-pct">{percent}%</span>
      </div>
      <div className="track">
        <div className="track-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="inline-card-grid">
        <div className="inline-card-cell">
          <div className="inline-card-label">CURRENT</div>
          <div className="inline-card-value">{current}</div>
        </div>
        <div className="inline-card-cell">
          <div className="inline-card-label">NEXT</div>
          <div className="inline-card-value dim">{next}</div>
        </div>
      </div>
      <div className="inline-card-cta">
        <span className="inline-card-cta-arrow">→</span>
        <span className="inline-card-cta-text">{cta}</span>
      </div>
    </div>
  );
}
