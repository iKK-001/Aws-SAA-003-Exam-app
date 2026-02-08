'use client';

import { getProgress } from '@/lib/data';
import { X } from 'lucide-react';
import type { Question } from '@/lib/data';

type Status = 'unanswered' | 'correct' | 'wrong';

export function AnswerSheet({
  open,
  onClose,
  list,
  currentIndex,
  onSelectIndex,
  onClearProgress,
}: {
  open: boolean;
  onClose: () => void;
  list: Question[];
  currentIndex: number;
  onSelectIndex: (i: number) => void;
  onClearProgress: () => void;
}) {
  const progress = typeof window !== 'undefined' ? getProgress() : {};

  const getStatus = (i: number): Status => {
    const q = list[i];
    if (!q) return 'unanswered';
    const p = progress[q.id];
    if (!p) return 'unanswered';
    return p.correct ? 'correct' : 'wrong';
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-aws-navy/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-float"
        role="dialog"
        aria-modal="true"
        aria-labelledby="answer-sheet-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-aws-navy/10 bg-white px-4 py-3">
          <h2 id="answer-sheet-title" className="text-lg font-bold text-aws-navy">
            答题卡
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onClearProgress();
                onClose();
              }}
              className="text-sm font-medium text-aws-blue-deep hover:underline"
            >
              清除进度
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-aws-navy/70 hover:bg-aws-navy/5"
              aria-label="关闭答题卡"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
          <div className="grid grid-cols-5 gap-2">
            {list.map((_, i) => {
              const status = getStatus(i);
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSelectIndex(i);
                    onClose();
                  }}
                  className={`
                    flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium
                    transition-[transform,box-shadow] active:scale-[0.98]
                    ${isCurrent
                      ? 'border-2 border-red-400 bg-red-50 text-aws-navy shadow-sm'
                      : status === 'correct'
                        ? 'border border-emerald-500/50 bg-emerald-500 text-white'
                        : status === 'wrong'
                          ? 'border border-red-500/50 bg-red-500 text-white'
                          : 'border border-aws-navy/15 bg-aws-navy/5 text-aws-navy/70'
                    }
                  `}
                  aria-label={`第 ${i + 1} 题${isCurrent ? '，当前' : ''}${status === 'correct' ? '，答对' : status === 'wrong' ? '，答错' : '，未做'}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-aws-navy/50">
            绿=答对 · 红=答错 · 红框=当前题 · 灰=未做
          </p>
        </div>
      </div>
    </>
  );
}
