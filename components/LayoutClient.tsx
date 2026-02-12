'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, TrendingUp, BookMarked, User, Menu } from 'lucide-react';
import { DrawerProvider } from '@/lib/DrawerContext';
import { getTheme, getUiTheme, setUiTheme } from '@/lib/data';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { Drawer } from './Drawer';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/practice', label: '练习', icon: BookOpen },
  { href: '/progress', label: '进步', icon: TrendingUp },
  { href: '/glossary', label: '百科', icon: BookMarked },
  { href: '/profile', label: '我的', icon: User },
];

function applyTheme(theme: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState<'term' | null>(null);
  const [drawerPayload, setDrawerPayload] = useState<{ termKey?: string } | null>(null);
  const [devUiTheme, setDevUiTheme] = useState<'default' | 'morandi'>(() =>
    typeof window !== 'undefined' ? getUiTheme() : 'default'
  );

  const openTermDrawer = (termKey: string) => {
    setDrawerPayload({ termKey });
    setDrawerContent('term');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerContent(null);
    setDrawerPayload(null);
  };

  useEffect(() => {
    const theme = getUiTheme() === 'morandi' ? 'morandi' : getTheme();
    applyTheme(theme);
    setDevUiTheme(getUiTheme());
  }, []);

  const handleDevUiPreview = (theme: 'default' | 'morandi') => {
    setUiTheme(theme);
    setDevUiTheme(theme);
  };

  return (
    <DrawerProvider
      onOpenTerm={openTermDrawer}
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
            <Link
              href="/profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-aws-navy hover:bg-aws-blue-light/50"
              aria-label="我的"
            >
              <User className="h-5 w-5" />
            </Link>
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

        {/* 仅开发环境：UI 风格切换，便于对比莫兰迪与默认样式 */}
        {process.env.NODE_ENV === 'development' && (
          <div
            className="fixed bottom-20 left-3 z-50 flex flex-col gap-1 rounded-2xl border border-aws-navy/10 bg-white/95 p-1.5 shadow-card backdrop-blur"
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0)' }}
          >
            <span className="px-2 py-0.5 text-[10px] font-medium text-aws-navy/50">UI 预览</span>
            <button
              type="button"
              onClick={() => handleDevUiPreview('default')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                devUiTheme === 'default' ? 'bg-aws-blue-light/60 text-aws-blue-deep' : 'text-aws-navy/70 hover:bg-aws-blue-light/30'
              }`}
            >
              默认
            </button>
            <button
              type="button"
              onClick={() => handleDevUiPreview('morandi')}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                devUiTheme === 'morandi' ? 'bg-aws-blue-light/60 text-aws-blue-deep' : 'text-aws-navy/70 hover:bg-aws-blue-light/30'
              }`}
            >
              莫兰迪
            </button>
          </div>
        )}
      </div>
    </DrawerProvider>
  );
}
