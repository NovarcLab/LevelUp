import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';

const FG_0 = '#FAFAFA';
const FG_2 = '#71717A';
const FG_3 = '#52525B';
const LINE_2 = 'rgba(255,255,255,0.1)';
const ACCENT = '#60A5FA';

export default function SupportTreeScene(): ReactElement {
  return (
    <div className="app">
      <TopBar context="Support Tree" right="esc" />
      <div style={{ position: 'relative', width: '100%', overflow: 'auto' }}>
        <svg
          viewBox="0 0 1440 820"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Level 0 — The Why */}
          <text x={64} y={88} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            LEVEL 0 — THE WHY
          </text>
          <text
            x={720}
            y={120}
            fill={FG_2}
            fontSize={17}
            textAnchor="middle"
            opacity={0.75}
            letterSpacing={-0.2}
          >
            Build a life where I choose what I work on.
          </text>

          {/* line 0 → 1 */}
          <rect x={720} y={144} width={1} height={24} fill={LINE_2} />

          {/* Level 1 */}
          <text x={64} y={188} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            LEVEL 1 — YEAR GOAL
          </text>
          <rect
            x={520}
            y={172}
            width={400}
            height={72}
            rx={8}
            fill="#18181B"
            stroke={LINE_2}
          />
          <rect x={540} y={202} width={8} height={8} fill={ACCENT} />
          <text x={560} y={209} fill={FG_0} fontSize={15} fontWeight={600} letterSpacing={-0.15}>
            Side Project MVP
          </text>
          <text x={560} y={228} fill={FG_2} fontSize={11}>
            58% · Finish MVP document
          </text>

          <rect x={720} y={248} width={1} height={24} fill={LINE_2} />

          {/* horizontal bar for milestones */}
          <rect x={280} y={272} width={880} height={1} fill={LINE_2} />
          <rect x={280} y={272} width={1} height={16} fill={LINE_2} />
          <rect x={573} y={272} width={1} height={16} fill={LINE_2} />
          <rect x={866} y={272} width={1} height={16} fill={LINE_2} />
          <rect x={1160} y={272} width={1} height={16} fill={LINE_2} />

          <text x={64} y={302} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            LEVEL 2 — MILESTONES
          </text>

          {/* Milestones */}
          {[
            { x: 180, title: 'Discovery', meta: 'DONE · MAR 18', metaColor: FG_3, current: false },
            { x: 473, title: 'MVP document', meta: 'IN PROGRESS · 58%', metaColor: ACCENT, current: true },
            { x: 766, title: 'Ship to 5 users', meta: 'WEEK 7', metaColor: FG_3, current: false },
            { x: 1060, title: 'Iterate', meta: 'WEEK 9', metaColor: FG_3, current: false },
          ].map((m) => (
            <g key={m.x}>
              <rect
                x={m.x}
                y={288}
                width={200}
                height={72}
                rx={8}
                fill="#18181B"
                stroke={m.current ? ACCENT : LINE_2}
                strokeOpacity={m.current ? 0.32 : 1}
              />
              <rect x={m.x + 16} y={314} width={6} height={6} fill={m.current ? ACCENT : FG_2} />
              <text x={m.x + 28} y={320} fill={FG_0} fontSize={14} fontWeight={500}>
                {m.title}
              </text>
              <text x={m.x + 16} y={344} fill={m.metaColor} fontSize={9} fontWeight={600} letterSpacing={1.8}>
                {m.meta}
              </text>
            </g>
          ))}

          {/* drop from current milestone */}
          <rect x={573} y={360} width={1} height={20} fill={LINE_2} />
          <rect x={473} y={380} width={200} height={1} fill={LINE_2} />
          <rect x={473} y={380} width={1} height={16} fill={LINE_2} />
          <rect x={673} y={380} width={1} height={16} fill={LINE_2} />

          <text x={64} y={412} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            LEVEL 3 — THIS WEEK
          </text>

          {/* actions */}
          {[
            { x: 383, title: 'Fill scope section', meta: '25 MIN · TONIGHT', metaColor: FG_2 },
            { x: 583, title: 'Outline user stories', meta: 'THURSDAY', metaColor: FG_3 },
          ].map((a) => (
            <g key={a.x}>
              <rect
                x={a.x}
                y={396}
                width={180}
                height={60}
                rx={6}
                fill="#09090B"
                stroke={LINE_2}
              />
              <text x={a.x + 16} y={420} fill={FG_0} fontSize={13} fontWeight={500}>
                {a.title}
              </text>
              <text x={a.x + 16} y={438} fill={a.metaColor} fontSize={9} fontWeight={600} letterSpacing={1.8}>
                {a.meta}
              </text>
            </g>
          ))}

          <rect x={573} y={456} width={1} height={28} fill={LINE_2} />

          <text x={64} y={500} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            LEVEL 4 — IMPLEMENTATION INTENTION
          </text>

          {/* binding card */}
          <rect
            x={383}
            y={484}
            width={380}
            height={108}
            rx={8}
            fill="#18181B"
            stroke={LINE_2}
          />
          <text
            x={403}
            y={506}
            fill={ACCENT}
            fontSize={9}
            fontWeight={600}
            letterSpacing={1.8}
          >
            THE BINDING
          </text>
          <text x={403} y={528} fill={FG_0} fontSize={12} fontWeight={500} letterSpacing={-0.1}>
            <tspan x={403} dy={0}>When it&apos;s 9pm and I sit at the desk,</tspan>
            <tspan x={403} dy={18}>I open the doc and fill the scope section,</tspan>
            <tspan x={403} dy={18}>until the 25-min timer runs out.</tspan>
          </text>

          {/* side card — read this tree */}
          <rect x={880} y={480} width={420} height={180} rx={8} fill="#18181B" stroke={LINE_2} />
          <text x={904} y={508} fill={FG_2} fontSize={9} fontWeight={600} letterSpacing={1.8}>
            READ THIS TREE
          </text>
          <text x={904} y={534} fill={FG_0} fontSize={12} fontWeight={500} letterSpacing={-0.1}>
            <tspan x={904} dy={0}>Each level exists to serve the one above it.</tspan>
            <tspan x={904} dy={20}>When a lower node goes silent, check if the</tspan>
            <tspan x={904} dy={20}>one above still holds. If it does, re-anchor.</tspan>
            <tspan x={904} dy={20}>If it doesn&apos;t, we rewrite the whole branch.</tspan>
          </text>

          <text
            x={64}
            y={820}
            fill={FG_2}
            fontSize={11}
            letterSpacing={-0.1}
          >
            Your path, one view.
          </text>
          <text
            x={1376}
            y={820}
            fill={ACCENT}
            fontSize={9}
            fontWeight={600}
            letterSpacing={1.8}
            textAnchor="end"
          >
            PHASE 2 PREVIEW
          </text>
        </svg>
      </div>
    </div>
  );
}
