'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useGlossary } from '@/lib/DataContext';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { GlossarySkeleton } from '@/components/Skeleton';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function FlashcardPage() {
  const { glossary, loading, error } = useGlossary();
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);

  const termKeys = useMemo(() => {
    if (!glossary) return [];
    return Object.keys(glossary).sort((a, b) => a.localeCompare(b));
  }, [glossary]);

  const currentTerm = currentKey && glossary ? glossary[currentKey] : null;

  const drawRandom = () => {
    if (termKeys.length === 0) return;
    const next = termKeys.length === 1 ? termKeys[0] : pickRandom(termKeys.filter((k) => k !== currentKey));
    setCurrentKey(next ?? pickRandom(termKeys));
    setFlipped(false);
  };

  if (loading) return <GlossarySkeleton />;
  if (error || !glossary) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">{error || '词库未加载'}</p>
        <Link href="/glossary" className="text-sm font-medium text-aws-blue-deep">
          返回百科
        </Link>
      </div>
    );
  }

  if (termKeys.length === 0) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">暂无术语</p>
        <Link href="/glossary" className="text-sm font-medium text-aws-blue-deep">
          返回百科
        </Link>
      </div>
    );
  }

  if (!currentKey) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/glossary"
            className="flex items-center gap-1 rounded-xl p-2 text-aws-navy/70 hover:bg-aws-blue-light/30"
            aria-label="返回百科"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-aws-navy">术语抽认</h1>
        </div>
        <p className="mb-6 text-sm text-aws-navy/60">共 {termKeys.length} 条 · 点下方开始</p>
        <button
          type="button"
          onClick={drawRandom}
          className="w-full rounded-2xl bg-aws-orange py-4 text-base font-medium text-white shadow-float active:scale-[0.98]"
        >
          随机抽一张
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          href="/glossary"
          className="flex items-center gap-1 rounded-xl p-2 text-aws-navy/70 hover:bg-aws-blue-light/30"
          aria-label="返回百科"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm text-aws-navy/60">共 {termKeys.length} 条</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="mb-6 flex min-h-[200px] w-full flex-col rounded-3xl border-2 border-aws-navy/10 bg-white p-6 text-left shadow-float transition-shadow active:scale-[0.99]"
        aria-label={flipped ? '翻转回正面' : '翻转看解释'}
      >
        {!flipped ? (
          <>
            <p className="flex-1 text-center text-xl font-semibold text-aws-blue-deep">{currentKey}</p>
            <p className="mt-2 text-center text-xs text-aws-navy/50">点一下看解释</p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-semibold text-aws-blue-deep">{currentKey}</p>
            {currentTerm && (
              <>
                <p className="text-sm text-aws-navy/90">{currentTerm.definition}</p>
                {currentTerm.analogy && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    记住：{currentTerm.analogy}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </button>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={drawRandom}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-aws-blue-deep py-3 text-white shadow-float active:scale-[0.98]"
        >
          <RotateCcw className="h-5 w-5" />
          再抽一张
        </button>
      </div>
    </div>
  );
}
