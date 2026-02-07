'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuestions } from '@/lib/DataContext';
import { getMockHistory, removeMockHistoryEntry } from '@/lib/data';
import type { MockHistoryEntry } from '@/lib/data';
import { ClipboardList, Clock, FileQuestion, Trash2, TrendingUp } from 'lucide-react';

const MOCK_COUNT = 65;
const MOCK_MINUTES = 130;

function formatHistoryDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}h${min}m`;
  }
  return `${m}分${s}秒`;
}

export default function MockPage() {
  const { questions, loading } = useQuestions();
  const [history, setHistory] = useState<MockHistoryEntry[]>([]);
  const canStart = !loading && questions.length >= MOCK_COUNT;

  useEffect(() => {
    setHistory(getMockHistory());
  }, []);

  const handleRemove = (id: string) => {
    removeMockHistoryEntry(id);
    setHistory(getMockHistory());
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-aws-navy">模拟考试</h2>
        <p className="mb-4 text-sm text-aws-navy/70">
          从题库随机抽取 {MOCK_COUNT} 道题，限时 {MOCK_MINUTES} 分钟，模拟真实 SAA 考试环境。交卷后可查看得分与错题。
        </p>
        <ul className="space-y-2 text-sm text-aws-navy/70">
          <li className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-aws-blue-deep" />
            共 {MOCK_COUNT} 题
          </li>
          <li className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-aws-blue-deep" />
            限时 {MOCK_MINUTES} 分钟
          </li>
        </ul>
      </div>

      {history.length > 0 && (
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-aws-navy">
            <TrendingUp className="h-5 w-5 text-aws-orange" />
            过往成绩
          </h3>
          <p className="mb-3 text-xs text-aws-navy/60">按时间倒序，可删除单条记录</p>
          <ul className="space-y-2">
            {history.map((entry) => {
              const rate = entry.total > 0 ? Math.round((entry.correctCount / entry.total) * 100) : 0;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-aws-slate-soft/80 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-aws-navy">
                      {entry.correctCount} / {entry.total}
                      <span className="ml-2 text-aws-orange">{rate}%</span>
                    </p>
                    <p className="text-xs text-aws-navy/60">
                      {formatHistoryDate(entry.date)} · 用时 {formatDuration(entry.timeSpentSeconds)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(entry.id)}
                    className="shrink-0 rounded-xl p-2 text-aws-navy/50 hover:bg-red-50 hover:text-red-600"
                    aria-label="删除此条成绩"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aws-blue-deep border-t-transparent" />
        </div>
      ) : (
        <Link
          href={canStart ? '/mock/run' : '#'}
          aria-disabled={!canStart}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 shadow-soft transition active:scale-[0.99] ${
            canStart
              ? 'bg-aws-orange text-white hover:opacity-95'
              : 'cursor-not-allowed bg-aws-navy/30 text-aws-navy/60'
          }`}
        >
          <ClipboardList className="h-5 w-5" />
          {canStart ? '开始模拟考' : `题库至少需 ${MOCK_COUNT} 题（当前 ${questions.length}）`}
        </Link>
      )}
    </div>
  );
}
