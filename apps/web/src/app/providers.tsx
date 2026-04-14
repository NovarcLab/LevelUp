'use client';

import type { ReactElement, ReactNode } from 'react';
import { ReducedMotionProvider } from '@levelup/motion';
import { KeyboardProvider } from '@/lib/keyboard';

export default function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <ReducedMotionProvider>
      <KeyboardProvider>
        {children}
      </KeyboardProvider>
    </ReducedMotionProvider>
  );
}
