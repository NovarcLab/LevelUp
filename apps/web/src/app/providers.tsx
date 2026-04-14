'use client';

import type { ReactElement, ReactNode } from 'react';
import { ReducedMotionProvider } from '@levelup/motion';
import { KeyboardProvider } from '@/lib/keyboard';
import { DrawerProvider } from '@/lib/drawer';
import { ThemeProvider } from '@/lib/theme';

export default function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ReducedMotionProvider>
      <ThemeProvider>
        <KeyboardProvider>
          <DrawerProvider>
            {children}
          </DrawerProvider>
        </KeyboardProvider>
      </ThemeProvider>
    </ReducedMotionProvider>
  );
}
