'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

const MOCK_COMPLETED_KEY = 'aws-mock-completed';

type NavItem = { href: string; label: string; icon: LucideIcon };

export function BottomNav({
  items,
  currentPath,
}: {
  items: NavItem[];
  currentPath: string;
}) {
  const [mockCompleted, setMockCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMockCompleted(localStorage.getItem(MOCK_COMPLETED_KEY) === '1');
  }, [currentPath]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-aws-blue-light/50 bg-white/95 py-2 shadow-card backdrop-blur lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = currentPath === href || (href !== '/' && currentPath.startsWith(href));
        const showMockBadge = href === '/mock' && mockCompleted === false;
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 rounded-2xl px-4 py-2 transition-colors ${
              active ? 'text-aws-blue-deep' : 'text-aws-navy/60'
            }`}
          >
            <span className="relative inline-block">
              <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
              {showMockBadge && (
                <span
                  className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-aws-orange"
                  aria-hidden
                />
              )}
            </span>
            <span className="text-xs font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
