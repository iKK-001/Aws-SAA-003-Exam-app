import type { Metadata, Viewport } from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';
import { DataProvider } from '@/lib/DataContext';
import { LayoutClient } from '@/components/LayoutClient';

const quicksand = Quicksand({
  subsets: ['latin'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AWS SAA 备考',
  description: 'AWS Solutions Architect Associate 备考练习与词库',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AWS SAA 备考',
  },
};

export const viewport: Viewport = {
  themeColor: '#232F3E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={quicksand.variable}>
      <body className="min-h-screen font-sans">
        <DataProvider>
          <LayoutClient>{children}</LayoutClient>
        </DataProvider>
      </body>
    </html>
  );
}
