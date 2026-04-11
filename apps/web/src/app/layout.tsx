import type { ReactElement, ReactNode } from 'react';
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
        {children}
        <ScenesNav />
      </body>
    </html>
  );
}
