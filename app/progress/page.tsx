'use client';

import { useMemo } from 'react';
import { getAnswerHistory } from '@/lib/data';
import LineChart from '@/components/LineChart';

type DayStat = { date: string; correct: number; total: number; pct: number };
type WindowStat = { label: string; correct: number; total: number; pct: number };

function useDailyStats() {
  return useMemo(() => {
    const list = getAnswerHistory();
    const byDay: Record<string, { correct: number; total: number }> = {};
    for (const { correct, date } of list) {
      if (!byDay[date]) byDay[date] = { correct: 0, total: 0 };
      byDay[date].total += 1;
      if (correct) byDay[date].correct += 1;
    }
    const days: DayStat[] = Object.entries(byDay)
      .map(([date, { correct, total }]) => ({ date, correct, total, pct: total ? (correct / total) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return days;
  }, []);
}

function useWindowStats(windowSize: number) {
  return useMemo(() => {
    const list = getAnswerHistory();
    const windows: WindowStat[] = [];
    for (let i = 0; i < list.length; i += windowSize) {
      const chunk = list.slice(i, i + windowSize);
      const correct = chunk.filter((r) => r.correct).length;
      const total = chunk.length;
      const start = i + 1;
      const end = i + total;
      windows.push({
        label: `第 ${start}-${end} 题`,
        correct,
        total,
        pct: total ? (correct / total) * 100 : 0,
      });
    }
    return windows;
  }, [windowSize]);
}

export default function ProgressPage() {
  const daily = useDailyStats();
  const per20 = useWindowStats(20);
  const per50 = useWindowStats(50);
  const hasAny = daily.length > 0;

  const dailyChartData = useMemo(
    () => daily.map((d) => ({ label: d.date, value: d.pct })),
    [daily]
  );
  const per20ChartData = useMemo(
    () => per20.map((w) => ({ label: w.label, value: w.pct })),
    [per20]
  );
  const per50ChartData = useMemo(
    () => per50.map((w) => ({ label: w.label, value: w.pct })),
    [per50]
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24">
      <h1 className="mb-2 text-xl font-bold text-aws-navy">进步曲线</h1>
      <p className="mb-6 text-sm text-aws-navy/60">
        按日或按题数查看正确率折线，坚持刷题可见趋势。
      </p>

      {!hasAny && (
        <div className="rounded-2xl border border-aws-blue-light/50 bg-aws-slate-soft/50 p-6 text-center text-sm text-aws-navy/70">
          暂无答题记录，去练习几题后再来看进步曲线吧。
        </div>
      )}

      {hasAny && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-aws-navy">按日正确率</h2>
            <div className="rounded-2xl border border-aws-navy/5 bg-white p-4 shadow-float">
              {dailyChartData.length === 0 ? (
                <p className="text-xs text-aws-navy/50">暂无按日数据</p>
              ) : (
                <LineChart data={dailyChartData} height={200} />
              )}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-aws-navy">按题数正确率（每 20 题）</h2>
            <div className="rounded-2xl border border-aws-navy/5 bg-white p-4 shadow-float">
              {per20ChartData.length === 0 ? (
                <p className="text-xs text-aws-navy/50">至少做满 1 题后按 20 题分段显示</p>
              ) : (
                <LineChart data={per20ChartData} height={200} />
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-aws-navy">按题数正确率（每 50 题）</h2>
            <div className="rounded-2xl border border-aws-navy/5 bg-white p-4 shadow-float">
              {per50ChartData.length === 0 ? (
                <p className="text-xs text-aws-navy/50">至少做满 1 题后按 50 题分段显示</p>
              ) : (
                <LineChart data={per50ChartData} height={200} />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
