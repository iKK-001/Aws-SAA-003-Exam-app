'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Clock, XCircle, RotateCcw, Home, BookOpen } from 'lucide-react';
import { addWrongId, addMockHistory } from '@/lib/data';

const MOCK_RESULT_KEY = 'aws-mock-result';

type MockResult = {
  score: number;
  total: number;
  correctCount: number;
  wrongIds: number[];
  timeSpentSeconds: number;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h} 小时 ${min} 分`;
  }
  return `${m} 分 ${s} 秒`;
}

export default function MockResultPage() {
  const [result, setResult] = useState<MockResult | null>(null);
  const [addedToWrong, setAddedToWrong] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(MOCK_RESULT_KEY);
      if (raw) {
        const data = JSON.parse(raw) as MockResult;
        setResult(data);
        localStorage.setItem('aws-mock-completed', '1');
        addMockHistory({
          date: new Date().toISOString(),
          correctCount: data.correctCount,
          total: data.total,
          timeSpentSeconds: data.timeSpentSeconds,
        });
        sessionStorage.removeItem(MOCK_RESULT_KEY);
      }
    } catch {
      setResult(null);
    }
  }, []);

  const handleAddToWrong = () => {
    if (!result?.wrongIds.length || addedToWrong) return;
    result.wrongIds.forEach((id) => addWrongId(id));
    setAddedToWrong(true);
  };

  if (result === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="flex min-h-safe flex-col items-center justify-center gap-6 text-center">
          <p className="text-aws-navy/80">暂无模拟考结果</p>
          <p className="text-sm text-aws-navy/60">
            完成一次模拟考后即可在此查看得分与错题。
          </p>
          <div className="flex gap-3">
            <Link
              href="/mock/run"
              className="rounded-2xl bg-aws-blue-deep px-4 py-3 text-sm font-medium text-white"
            >
              开始模拟考
            </Link>
            <Link
              href="/"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-aws-navy shadow-soft"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rate =
    result.total > 0
      ? Math.round((result.correctCount / result.total) * 100)
      : 0;
  const pass = rate >= 72; // SAA 通常 72% 通过线左右
  const encouragement =
    rate >= 80
      ? '正确率很高，继续保持！'
      : rate >= 72
        ? '达到常见通过线，再接再厉。'
        : rate >= 60
          ? '再巩固一下错题，下次会更好。'
          : '多练几套题，熟悉考点后再考。';

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card text-center">
        <div className="mb-4 flex justify-center">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              pass ? 'bg-green-100 text-green-600' : 'bg-aws-blue-light/50 text-aws-blue-deep'
            }`}
          >
            <Trophy className="h-8 w-8" />
          </span>
        </div>
        <h2 className="mb-1 text-lg font-semibold text-aws-navy">模拟考结果</h2>
        <p className="mb-2 text-3xl font-bold text-aws-blue-deep">
          {result.correctCount} / {result.total}
        </p>
        <p className="mb-2 text-sm text-aws-navy/70">
          正确率 <span className="font-semibold text-aws-navy">{rate}%</span>
          {pass ? ' · 达到常见通过线' : ''}
        </p>
        <p className="mb-3 text-sm font-medium text-aws-navy/90">{encouragement}</p>
        <p className="flex items-center justify-center gap-1.5 text-sm text-aws-navy/60">
          <Clock className="h-4 w-4" />
          用时 {formatDuration(result.timeSpentSeconds)}
        </p>
      </section>

      {result.wrongIds.length > 0 && (
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-aws-navy">
            <XCircle className="h-5 w-5 text-red-500" />
            错题共 {result.wrongIds.length} 道
          </h3>
          <p className="mb-3 text-xs text-aws-navy/60">
            题号：{result.wrongIds.slice(0, 20).join('、')}
            {result.wrongIds.length > 20 &&
              ` … 等 ${result.wrongIds.length} 题`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddToWrong}
              disabled={addedToWrong}
              className="flex items-center gap-2 rounded-xl bg-aws-blue-light/50 px-4 py-2 text-sm font-medium text-aws-blue-deep disabled:opacity-60"
            >
              <BookOpen className="h-4 w-4" />
              {addedToWrong ? '已加入错题本' : '加入错题本'}
            </button>
            <Link
              href="/practice?filter=wrong"
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-aws-navy shadow-soft"
            >
              去练错题
            </Link>
          </div>
        </section>
      )}

      <nav className="flex flex-col gap-3">
        <Link
          href="/mock/run"
          className="flex items-center justify-center gap-2 rounded-2xl bg-aws-orange py-3.5 font-medium text-white shadow-soft active:scale-[0.99]"
        >
          <RotateCcw className="h-5 w-5" />
          再考一次
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-2xl border border-aws-navy/15 bg-white py-3.5 text-sm font-medium text-aws-navy/80 shadow-soft active:scale-[0.99]"
        >
          <Home className="h-5 w-5" />
          返回首页
        </Link>
      </nav>
    </div>
  );
}
