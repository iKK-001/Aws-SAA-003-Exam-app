'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useGlossary } from '@/lib/DataContext';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  variant: 'term' | null;
  payload: { termKey?: string } | null;
};

export function Drawer({ open, onClose, variant, payload }: DrawerProps) {
  const { glossary } = useGlossary();
  const termKey = payload?.termKey ?? null;
  const term = termKey && glossary ? glossary[termKey] : null;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-aws-navy/20 backdrop-blur-sm"
        aria-label="关闭"
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-drawer drawer-enter"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
        role="dialog"
        aria-modal="true"
        aria-label={variant === 'term' && termKey ? `术语：${termKey}` : '详情'}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-aws-blue-light/50 px-4">
          <span className="text-base font-semibold text-aws-navy">
            {variant === 'term' && termKey ? termKey : '详情'}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-aws-navy hover:bg-aws-blue-light/50"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {variant === 'term' && term && (
            <div className="space-y-4">
              <p className="text-aws-navy/90">{term.definition}</p>
              {term.analogy && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 shadow-float">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    记住：{termKey} 就像
                  </p>
                  <p className="text-sm font-medium text-aws-navy">
                    {term.analogy}
                  </p>
                </div>
              )}
              {term.features?.length ? (
                <ul className="space-y-2">
                  {term.features.map((f: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-aws-navy/80">
                      <span className="text-aws-blue-deep">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          {variant === 'term' && termKey && !term && (
            <p className="text-aws-navy/60">暂无该术语解释，可在百科页查看全部词条。</p>
          )}
        </div>
      </div>
    </>
  );
}
