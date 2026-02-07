'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

export function Sidebar({
  items,
  currentPath,
  open,
  onClose,
}: {
  items: NavItem[];
  currentPath: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* 移动端遮罩 */}
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-aws-navy/30 backdrop-blur-sm lg:hidden"
          aria-label="关闭菜单"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 h-full w-64 shrink-0 transform border-r border-aws-blue-light/50 bg-white shadow-card transition-transform duration-200 ease-out
          lg:translate-x-0 lg:pt-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-14 items-center justify-between border-b border-aws-blue-light/50 px-4 lg:justify-center">
          <span className="text-sm font-semibold text-aws-navy">AWS SAA 备考</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-aws-navy hover:bg-aws-blue-light/50 lg:hidden"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = currentPath === href || (href !== '/' && currentPath.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  active ? 'bg-aws-blue-light/60 text-aws-blue-deep' : 'text-aws-navy hover:bg-aws-blue-light/40'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
