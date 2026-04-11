import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';

// Colors (match globals.css so the SVG stays in sync)
const FG_0 = '#FAFAFA';
const FG_2 = '#71717A';
const FG_3 = '#52525B';
const LINE_1 = 'rgba(255,255,255,0.06)';
const LINE_2 = 'rgba(255,255,255,0.1)';
const ACCENT = '#60A5FA';
const SIGNAL = '#FB923C';

// Horizontal layout - 1312 wide axis
const W = 1312;
const PAD_L = 64;
// months positions (APR, MAY, JUN, JUL, AUG)
const months = [
  { label: 'APR', x: 0 },
  { label: 'MAY', x: 328 },
  { label: 'JUN', x: 656 },
  { label: 'JUL', x: 984 },
  { label: 'AUG', x: 1288 },
];
// NOW line at APR 11 — roughly 112 px past APR start
const NOW_X = 112;

interface Track {
  name: string;
  meta: string;
  metaColor: string;
  trackDoneX: number;
  nodes: Array<{ x: number; color: string; label: string; labelAbove?: boolean; bright?: boolean; ring?: boolean }>;
}

const tracks: Track[] = [
  {
    name: 'Side Project MVP',
    meta: 'MVP BY JUN 15',
    metaColor: FG_2,
    trackDoneX: 112,
    nodes: [
      { x: 22, color: FG_2, label: 'Discovery', labelAbove: true },
      { x: 108, color: ACCENT, label: 'MVP document', bright: true, ring: true },
      { x: 364, color: FG_3, label: 'Ship to 5 users' },
      { x: 656, color: FG_3, label: 'Iterate' },
    ],
  },
  {
    name: 'Daily 500 words',
    meta: 'HABIT · DAILY',
    metaColor: FG_2,
    trackDoneX: 112,
    nodes: [
      { x: 26, color: FG_2, label: '7-day run', labelAbove: true },
      { x: 76, color: FG_2, label: '', labelAbove: false },
      { x: 108, color: ACCENT, label: '12-day streak', bright: true },
      { x: 264, color: FG_3, label: '30-day anchor' },
      { x: 656, color: FG_3, label: 'First 20k draft' },
    ],
  },
  {
    name: 'Read 24 books',
    meta: 'STALLED · 16 DAYS',
    metaColor: SIGNAL,
    trackDoneX: 50,
    nodes: [
      { x: 22, color: FG_2, label: '3 done', labelAbove: true },
      { x: 286, color: FG_3, label: 'Quarter 1 · 6 books' },
      { x: 756, color: FG_3, label: 'Half year · 12' },
    ],
  },
];

function Track({
  track,
  y,
}: {
  track: Track;
  y: number;
}): ReactElement {
  return (
    <g transform={`translate(0 ${y})`}>
      <text x={PAD_L} y={0} fill={FG_0} fontSize={13} fontWeight={600} letterSpacing={-0.15}>
        {track.name}
      </text>
      <text x={PAD_L} y={20} fill={track.metaColor} fontSize={9} fontWeight={600} letterSpacing={1.8}>
        {track.meta}
      </text>
      <rect x={PAD_L} y={56} width={W} height={1} fill={LINE_1} />
      <rect x={PAD_L} y={56} width={track.trackDoneX} height={1} fill={track.metaColor === SIGNAL ? FG_2 : ACCENT} />
      {track.nodes.map((n, i) => (
        <g key={i} transform={`translate(${PAD_L + n.x} 56)`}>
          {n.ring && (
            <circle cx={3} cy={0} r={13} fill="none" stroke={ACCENT} strokeOpacity={0.32} />
          )}
          <rect x={0} y={-3} width={6} height={6} fill={n.color} />
          {n.label && (
            <text
              x={n.labelAbove ? -4 : -10}
              y={n.labelAbove ? -8 : 23}
              fill={n.bright ? FG_0 : FG_2}
              fontSize={11}
              fontWeight={n.bright ? 600 : 500}
              letterSpacing={-0.1}
            >
              {n.label}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

export default function RoadmapScene(): ReactElement {
  return (
    <div className="app">
      <TopBar context="The Path" right="esc" />
      <div className="roadmap-head">
        <div>
          <div className="roadmap-tag">GLOBAL ROADMAP</div>
          <div className="roadmap-title">Next 120 days</div>
        </div>
        <div className="roadmap-legend">
          <div className="legend-item">
            <div className="dot active" />
            ACTIVE
          </div>
          <div className="legend-item">
            <div className="dot idle" />
            DONE
          </div>
          <div className="legend-item">
            <div className="dot archived" />
            AHEAD
          </div>
        </div>
      </div>

      <svg
        className="roadmap-svg"
        viewBox="0 0 1440 600"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Month labels and axis */}
        {months.map((m) => (
          <g key={m.label}>
            <text
              x={PAD_L + m.x}
              y={64}
              fill={FG_2}
              fontSize={9}
              fontWeight={600}
              letterSpacing={1.8}
            >
              {m.label}
            </text>
            <rect x={PAD_L + m.x} y={88} width={1} height={9} fill={LINE_2} />
          </g>
        ))}
        <rect x={PAD_L} y={92} width={W} height={1} fill={LINE_2} />

        {/* NOW line */}
        <rect
          x={PAD_L + NOW_X}
          y={92}
          width={1}
          height={440}
          fill={ACCENT}
          opacity={0.6}
        />
        <text
          x={PAD_L + NOW_X + 8}
          y={104}
          fill={ACCENT}
          fontSize={9}
          fontWeight={600}
          letterSpacing={1.8}
        >
          NOW · APR 11
        </text>

        {/* Tracks */}
        <Track track={tracks[0]!} y={168} />
        <Track track={tracks[1]!} y={312} />
        <Track track={tracks[2]!} y={456} />
      </svg>

      <div className="roadmap-foot">
        <span>Tap any node to talk about it · ⌘↵ to jump in</span>
        <span className="roadmap-foot-tag">PHASE 2 PREVIEW</span>
      </div>
    </div>
  );
}
