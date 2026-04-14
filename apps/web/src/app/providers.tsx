'use client';

import type { ReactElement, ReactNode } from 'react';
import { ReducedMotionProvider } from '@levelup/motion';
import { KeyboardProvider } from '@/lib/keyboard';
import { DrawerProvider } from '@/lib/drawer';

export default function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ReducedMotionProvider>
      <KeyboardProvider>
        <DrawerProvider>
          {children}
        </DrawerProvider>
      </KeyboardProvider>
    </ReducedMotionProvider>
  );
}
