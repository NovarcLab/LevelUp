'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

const SCENES: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Chat' },
  { href: '/onboarding', label: 'Onboard' },
  { href: '/scenes/empty', label: 'Empty' },
  { href: '/scenes/milestone', label: 'Milestone' },
  { href: '/scenes/lost', label: 'Lost' },
  { href: '/scenes/cmd', label: '⌘K' },
  { href: '/scenes/drawer', label: 'Drawer' },
  { href: '/scenes/settings', label: 'Settings' },
  { href: '/scenes/roadmap', label: 'Roadmap' },
  { href: '/scenes/support-tree', label: 'Support' },
];

export default function ScenesNav(): ReactElement {
  // Hide in production — dev-only navigation
  if (process.env.NODE_ENV === 'production') return <></>;

  const pathname = usePathname();
  return (
    <nav className="scenes-nav">
      {SCENES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={pathname === s.href ? 'active' : ''}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
