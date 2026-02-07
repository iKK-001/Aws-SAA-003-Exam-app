'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Trash2, Info } from 'lucide-react';
import { useGlossary } from '@/lib/DataContext';
import {
  clearAllLocalData,
  getMascotPhrasesEnabled,
  setMascotPhrasesEnabled,
  getTheme,
  setTheme,
  getSoundEnabled,
  setSoundEnabled,
  type ThemeId,
} from '@/lib/data';

const MASCOT_PHRASES_TOGGLED = 'mascot-phrases-toggled';

function MascotPhrasesToggle() {
  const [on, setOn] = useState(() => getMascotPhrasesEnabled());
  const handleToggle = () => {
    const next = !on;
    setMascotPhrasesEnabled(next);
    setOn(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MASCOT_PHRASES_TOGGLED));
    }
  };
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/60 py-2 pr-2">
      <span className="text-sm text-aws-navy/90">显示小助手陪伴语</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={handleToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? 'bg-aws-orange' : 'bg-aws-navy/20'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </label>
  );
}

function ThemeSelector() {
  const [theme, setThemeState] = useState<ThemeId>(() => getTheme());
  const handleSelect = (t: ThemeId) => {
    setTheme(t);
    setThemeState(t);
  };
  return (
    <div className="rounded-xl bg-white/60 py-2">
      <p className="mb-2 text-sm font-medium text-aws-navy/90">主题 / 皮肤</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSelect('relaxed')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
            theme === 'relaxed'
              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400'
              : 'bg-aws-navy/10 text-aws-navy/80 hover:bg-aws-navy/20'
          }`}
        >
          轻松
        </button>
        <button
          type="button"
          onClick={() => handleSelect('focus')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
            theme === 'focus'
              ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400'
              : 'bg-aws-navy/10 text-aws-navy/80 hover:bg-aws-navy/20'
          }`}
        >
          专注
        </button>
      </div>
    </div>
  );
}

function SoundToggle() {
  const [on, setOn] = useState(() => getSoundEnabled());
  const handleToggle = () => {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
  };
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/60 py-2 pr-2">
      <span className="text-sm text-aws-navy/90">答对 / 答错音效</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={handleToggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? 'bg-aws-orange' : 'bg-aws-navy/20'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </label>
  );
}

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  variant: 'term' | 'settings' | null;
  payload: { termKey?: string } | null;
};

export function Drawer({ open, onClose, variant, payload }: DrawerProps) {
  const router = useRouter();
  const { glossary } = useGlossary();
  const termKey = payload?.termKey ?? null;
  const term = termKey && glossary ? glossary[termKey] : null;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClearData = () => {
    if (typeof window !== 'undefined' && window.confirm('确定清除全部本地数据吗？做题进度、错题、收藏、考试日期、收藏术语将全部清空。')) {
      clearAllLocalData();
      onClose();
      router.refresh();
    }
  };

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
        aria-label={variant === 'term' && termKey ? `术语：${termKey}` : variant === 'settings' ? '设置' : '详情'}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-aws-blue-light/50 px-4">
          <span className="text-base font-semibold text-aws-navy">
            {variant === 'term' && termKey ? termKey : variant === 'settings' ? '设置' : '详情'}
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
          {variant === 'settings' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-aws-blue-light/20 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-aws-navy">
                  <Info className="h-4 w-4 text-aws-blue-deep" /> 关于
                </h3>
                <p className="mb-4 text-sm text-aws-navy/70">
                  AWS SAA 备考 App，支持按题练习、按分类刷题、百科词库与错题/收藏。数据仅存于本机，可随时清除。
                </p>
                <MascotPhrasesToggle />
                <div className="mt-3">
                  <ThemeSelector />
                </div>
                <div className="mt-3">
                  <SoundToggle />
                </div>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-aws-navy">
                  <Trash2 className="h-4 w-4 text-red-600" /> 清除本地数据
                </h3>
                <p className="mb-3 text-xs text-aws-navy/70">
                  将清除做题进度、错题、收藏题、收藏术语、考试日期目标。操作不可恢复。
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onClose()}
                    className="rounded-xl border border-aws-navy/20 bg-white px-4 py-2 text-sm font-medium text-aws-navy/80 hover:bg-aws-blue-light/30"
                  >
                    暂不
                  </button>
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
                  >
                    确定清除
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
