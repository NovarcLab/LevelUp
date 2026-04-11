import type { ReactElement } from 'react';
import TopBar from '@/components/TopBar';
import Halo from '@/components/Halo';

export default function LostScene(): ReactElement {
  return (
    <div className="app">
      <TopBar right="none" />
      <Halo size={900} y="40%" opacity={0.6} style={{ position: 'absolute' }} />
      <div className="body-center" style={{ paddingTop: 96 }}>
        <div className="lost-col">
          <div className="msg-user">
            <div className="msg-user-text" style={{ color: 'var(--fg-1)' }}>
              I don&apos;t think I&apos;m cut out for this.
            </div>
            <div className="msg-user-line" />
          </div>
          <div className="pause-bar">
            <div className="pause-line" />
            <div className="pause-text">2 SECONDS</div>
            <div className="pause-line" />
          </div>
          <div className="lost-headline">I&apos;m here.</div>
          <div className="lost-follow">
            Do you want to talk — or do you want silence for a bit?
          </div>
        </div>
      </div>
    </div>
  );
}
