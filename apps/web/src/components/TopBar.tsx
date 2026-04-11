import type { ReactElement } from 'react';

interface TopBarProps {
  context?: string | undefined;
  right?: 'default' | 'esc' | 'none';
}

export default function TopBar({ context, right = 'default' }: TopBarProps): ReactElement {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-dot" />
          <span className="brand-name">LEVELUP</span>
        </div>
        {context ? (
          <>
            <span className="brand-sep">·</span>
            <span className="brand-context">{context}</span>
          </>
        ) : null}
      </div>
      <div className="topbar-right">
        {right === 'default' && (
          <>
            <span className="kbd">⌘K</span>
            <span className="icon-btn">⚙</span>
          </>
        )}
        {right === 'esc' && <span className="kbd">ESC</span>}
      </div>
    </div>
  );
}
