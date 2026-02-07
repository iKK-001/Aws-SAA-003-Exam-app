'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, ClipboardList, BookMarked, User, Menu } from 'lucide-react';
import { DrawerProvider } from '@/lib/DrawerContext';
import { getTheme } from '@/lib/data';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Drawer } from './Drawer';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/practice', label: '练习', icon: BookOpen },
  { href: '/mock', label: '模拟考', icon: ClipboardList },
  { href: '/glossary', label: '百科', icon: BookMarked },
  { href: '/profile', label: '我的', icon: User },
];

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<'term' | 'settings' | null>(null);
  const [drawerPayload, setDrawerPayload] = useState<{ termKey?: string } | null>(null);

  const openTermDrawer = (termKey: string) => {
    setDrawerPayload({ termKey });
    setDrawerContent('term');
    setDrawerOpen(true);
  };

  const openSettingsDrawer = () => {
    setDrawerContent('settings');
    setDrawerPayload(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerContent(null);
    setDrawerPayload(null);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = getTheme();
  }, []);

  return (
    <DrawerProvider
      onOpenTerm={openTermDrawer}
      onOpenSettings={openSettingsDrawer}
      open={drawerOpen}
      content={drawerContent}
      payload={drawerPayload}
      onClose={closeDrawer}
    >
      <div className="flex min-h-screen">
        <Sidebar
          items={navItems}
          currentPath={pathname}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex h-screen flex-1 flex-col overflow-hidden lg:pl-64">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-aws-blue-light/50 bg-white/95 px-4 shadow-soft backdrop-blur lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-aws-navy hover:bg-aws-blue-light/50"
              aria-label="打开菜单"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="flex-1 text-center text-base font-semibold text-aws-navy">AWS SAA 备考</span>
            <button
              type="button"
              onClick={openSettingsDrawer}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-aws-navy hover:bg-aws-blue-light/50"
              aria-label="设置"
            >
              <User className="h-5 w-5" />
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto pb-nav">{children}</main>

          <BottomNav items={navItems} currentPath={pathname} />
        </div>

        <Drawer
          open={drawerOpen}
          onClose={closeDrawer}
          variant={drawerContent}
          payload={drawerPayload}
        />
      </div>
    </DrawerProvider>
  );
}
