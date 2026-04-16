'use client';

import { type ReactElement, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from './reduced-motion';
import { duration, ease } from './tokens';

interface SidebarSlideProps {
  collapsed: boolean;
  children: ReactNode;
}

/**
 * Animated sidebar width transition.
 * 320ms ease-io between collapsed (56px) and expanded (280px).
 * Children stagger in with 30ms delay, Y -8→0, opacity 0→1, 200ms.
 */
export function SidebarSlide({
  collapsed,
  children,
}: SidebarSlideProps): ReactElement {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div style={{ width: collapsed ? 56 : 280 }}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      animate={{ width: collapsed ? 56 : 280 }}
      transition={{ duration: duration.mid / 1000, ease: ease.io }}
    >
      {children}
    </motion.div>
  );
}

interface SidebarItemProps {
  children: ReactNode;
  index?: number;
}

export function SidebarItem({ children, index = 0 }: SidebarItemProps): ReactElement {
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: duration.base / 1000,
        ease: ease.out,
        delay: index * 0.03,
      }}
    >
      {children}
    </motion.div>
  );
}

interface SidebarPresenceProps {
  show: boolean;
  children: ReactNode;
}

export function SidebarPresence({ show, children }: SidebarPresenceProps): ReactElement {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: duration.base / 1000, ease: ease.out }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
