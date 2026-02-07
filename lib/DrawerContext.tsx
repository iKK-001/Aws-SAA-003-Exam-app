'use client';

import { createContext, useContext, useCallback, useState } from 'react';

type DrawerVariant = 'term' | 'settings' | null;

type DrawerContextValue = {
  openTermDrawer: (termKey: string) => void;
  openSettingsDrawer: () => void;
  drawerOpen: boolean;
  drawerContent: DrawerVariant;
  drawerPayload: { termKey?: string } | null;
  closeDrawer: () => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({
  children,
  onOpenTerm,
  onOpenSettings,
  open,
  content,
  payload,
  onClose,
}: {
  children: React.ReactNode;
  onOpenTerm: (termKey: string) => void;
  onOpenSettings: () => void;
  open: boolean;
  content: DrawerVariant;
  payload: { termKey?: string } | null;
  onClose: () => void;
}) {
  const value: DrawerContextValue = {
    openTermDrawer: onOpenTerm,
    openSettingsDrawer: onOpenSettings,
    drawerOpen: open,
    drawerContent: content,
    drawerPayload: payload,
    closeDrawer: onClose,
  };
  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
}
