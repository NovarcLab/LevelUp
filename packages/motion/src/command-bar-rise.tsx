'use client';

import { type ReactElement, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from './reduced-motion';
import { duration, ease } from './tokens';

interface CommandBarRiseProps {
  open: boolean;
  children: ReactNode;
}

const variants = {
  hidden: { scale: 0.96, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.28, ease: ease.spring },
  },
  exit: {
    scale: 0.96,
    opacity: 0,
    transition: { duration: duration.fast / 1000, ease: ease.in },
  },
};

/**
 * Command bar overlay: scale 0.96→1, opacity 0→1, spring ease.
 * Exit: scale 1→0.96, 120ms ease-in.
 */
export function CommandBarRise({
  open,
  children,
}: CommandBarRiseProps): ReactElement {
  const reduced = useReducedMotion();

  if (reduced) {
    return open ? <>{children}</> : <></>;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
