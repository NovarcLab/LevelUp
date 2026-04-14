'use client';

import type { ReactElement } from 'react';
import { useTheme } from '@/lib/theme';

export default function NightBanner(): ReactElement {
  const { showNightBanner, setTheme, dismissNightBanner } = useTheme();

  if (!showNightBanner) return <></>;

  return (
    <div className="night-banner">
      <span>It&apos;s late. Switch to dark mode?</span>
      <button
        className="night-banner-btn"
        onClick={() => {
          setTheme('dark');
          dismissNightBanner();
        }}
      >
        Yes
      </button>
      <button
        className="night-banner-btn dim"
        onClick={dismissNightBanner}
      >
        Not now
      </button>
    </div>
  );
}
