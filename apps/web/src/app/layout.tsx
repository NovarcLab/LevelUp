import type { ReactElement, ReactNode } from 'react';
import Providers from './providers';
import GlobalShortcuts from '@/components/GlobalShortcuts';
import CommandBar from '@/components/CommandBar';
import DrawerHost from '@/components/DrawerHost';
import NightBanner from '@/components/NightBanner';
import ScenesNav from '@/components/ScenesNav';
import './globals.css';

export const metadata = {
  title: 'LevelUp',
  description: 'Your growth companion — one who walked the road with you.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Providers>
          <GlobalShortcuts />
          <NightBanner />
          {children}
          <CommandBar />
          <DrawerHost />
          <ScenesNav />
        </Providers>
      </body>
    </html>
  );
}
