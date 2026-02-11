'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, ClipboardList, BookMarked, Target, ChevronRight, Info, Lightbulb, XCircle, Heart } from 'lucide-react';
import { useQuestions } from '@/lib/DataContext';
import { getProgress, getWrongIds, getFavoriteIds, getExamDateTarget, setExamDateTarget, getTodayPracticeCount, getNickname } from '@/lib/data';
import { getHomeGreeting } from '@/lib/mascotPhrases';
import { HomeSkeleton } from '@/components/Skeleton';

export default function HomePage() {
  const { questions, loading, error } = useQuestions();
  const progress = getProgress();
  const wrongIds = getWrongIds();
  const favoriteIds = getFavoriteIds();
  const [examDate, setExamDate] = useState('');
  const [goalInputValue, setGoalInputValue] = useState('');

  useEffect(() => {
    setExamDate(getExamDateTarget() ?? '');
  }, []);

  const done = Object.keys(progress).length;
  const correct = Object.values(progress).filter((v) => v.correct).length;
  const total = questions.length;
  const remaining = total ? Math.max(0, total - done) : 0;
  const correctRate = done ? Math.round((correct / done) * 100) : null;
  const daysToExam = examDate
    ? Math.ceil((new Date(examDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  const todayCount = getTodayPracticeCount();
  const nickname = getNickname();
  const greeting = getHomeGreeting(nickname);

  if (error) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">{error}</p>
        <p className="text-sm text-aws-navy/60">请将 questions_v2.json 与 glossary.json 放入 public/data/ 后刷新</p>
      </div>
    );
  }

  const handleSaveGoalDate = () => {
    const v = goalInputValue.trim();
    if (!v) return;
    setExamDateTarget(v);
    setExamDate(v);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {!examDate && (
        <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-aws-navy">
            <Target className="h-5 w-5 text-aws-blue-deep" />
            设定考试目标日期
          </h2>
          <p className="mb-3 text-xs text-aws-navy/60">
            选一个目标考试日，首页会显示倒计时，激励你按计划备考
          </p>
          <div className="flex gap-2">
            <input
              type="date"
              value={goalInputValue}
              onChange={(e) => setGoalInputValue(e.target.value)}
              className="flex-1 rounded-2xl border border-aws-blue-light/50 bg-aws-slate-soft px-4 py-3 text-aws-navy focus:border-aws-blue-deep focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSaveGoalDate}
              disabled={!goalInputValue.trim()}
              className="rounded-2xl bg-aws-orange px-4 py-3 font-medium text-white shadow-soft disabled:opacity-50 active:scale-[0.98]"
            >
              保存
            </button>
          </div>
        </section>
      )}
      <p className="mb-4 text-sm text-aws-navy/70">
        {nickname ? (
          <>
            <span className="font-semibold text-aws-navy">{greeting}</span>
            <span className="ml-2 text-aws-navy/60">· 今日已练 {todayCount} 题</span>
          </>
        ) : (
          <>
            <span className="font-medium text-aws-orange">今日已练 {todayCount} 题</span>
            {' · '}
            <span className="text-aws-navy/80">{greeting}</span>
          </>
        )}
      </p>
      <section className="mb-8 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-aws-navy">学习概览</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-aws-blue-light/40 p-3 text-center">
            <p className="text-2xl font-bold text-aws-blue-deep">{done}</p>
            <p className="text-xs text-aws-navy/70">已做</p>
          </div>
          <div className="rounded-2xl bg-aws-blue-light/40 p-3 text-center">
            <p className="text-2xl font-bold text-aws-blue-deep">{loading ? '—' : total}</p>
            <p className="text-xs text-aws-navy/70">总题</p>
          </div>
          <div className="rounded-2xl bg-aws-blue-deep p-3 text-center text-white">
            <p className="text-2xl font-bold">
              {correctRate !== null ? `${correctRate}%` : '—'}
            </p>
            <p className="text-xs text-white/90">正确率</p>
            {done === 0 && (
              <p className="mt-0.5 text-[10px] text-white/70">做完题后显示</p>
            )}
          </div>
        </div>
        {!loading && remaining > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-aws-navy/80">
            <span className="rounded-lg bg-aws-orange/20 px-2 py-0.5 text-aws-orange">剩余 {remaining} 题</span>
          </p>
        )}
        {loading && (
          <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-aws-blue-light/40" />
        )}
        {examDate && (
          <p className="mt-1 text-sm text-aws-navy/70">
            <Target className="mr-1 inline h-4 w-4" /> 目标考试日：{examDate}
            {daysToExam !== null && (
              <span className="ml-1 text-aws-blue-deep">
                {daysToExam > 0 ? `（距考试 ${daysToExam} 天）` : daysToExam === 0 ? '（今天）' : '（已过）'}
              </span>
            )}
          </p>
        )}
      </section>

      <nav className="space-y-2">
        <Link
          href="/practice"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="font-medium text-aws-navy">按题练习</span>
          </span>
          <ChevronRight className="h-5 w-5 text-aws-navy/40" />
        </Link>
        <Link
          href="/mock"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <ClipboardList className="h-5 w-5" />
            </span>
            <span className="font-medium text-aws-navy">模拟考试</span>
          </span>
          <ChevronRight className="h-5 w-5 text-aws-navy/40" />
        </Link>
        <Link
          href="/glossary"
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <BookMarked className="h-5 w-5" />
            </span>
            <span className="font-medium text-aws-navy">百科词库</span>
          </span>
          <ChevronRight className="h-5 w-5 text-aws-navy/40" />
        </Link>
        {wrongIds.length > 0 && (
          <Link
            href="/practice?filter=wrong&mode=order&sample=5"
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <XCircle className="h-5 w-5" />
              </span>
              <span className="font-medium text-aws-navy">错题本 · 随机 5 题再练</span>
            </span>
            <ChevronRight className="h-5 w-5 text-aws-navy/40" />
          </Link>
        )}
        {favoriteIds.length > 0 && (
          <Link
            href="/practice?filter=favorite&mode=order&sample=5"
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-400">
                <Heart className="h-5 w-5" />
              </span>
              <span className="font-medium text-aws-navy">收藏 · 随机 5 题再练</span>
            </span>
            <ChevronRight className="h-5 w-5 text-aws-navy/40" />
          </Link>
        )}
      </nav>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/practice?filter=wrong"
          className="rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
        >
          <p className="text-lg font-semibold text-aws-blue-deep">{wrongIds.length}</p>
          <p className="text-sm text-aws-navy/70">错题</p>
          <p className="mt-1 text-xs text-aws-navy/60">点击练习</p>
        </Link>
        <Link
          href="/practice?filter=favorite"
          className="rounded-2xl bg-white p-4 shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
        >
          <p className="text-lg font-semibold text-aws-blue-deep">{favoriteIds.length}</p>
          <p className="text-sm text-aws-navy/70">收藏</p>
          <p className="mt-1 text-xs text-aws-navy/60">点击练习</p>
        </Link>
      </div>

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-aws-navy">
          <Info className="h-5 w-5 text-aws-blue-deep" />
          SAA-C03 考试信息
        </h2>
        <ul className="space-y-2 text-sm text-aws-navy/80">
          <li><span className="font-medium text-aws-navy">考试名称</span> AWS Certified Solutions Architect – Associate (SAA-C03)</li>
          <li><span className="font-medium text-aws-navy">题数</span> 65 题（单选、多选）</li>
          <li><span className="font-medium text-aws-navy">时长</span> 130 分钟</li>
          <li><span className="font-medium text-aws-navy">通过分数</span> 720 / 1000</li>
          <li><span className="font-medium text-aws-navy">证书有效期</span> 3 年</li>
        </ul>
      </section>

      <section className="mt-4 rounded-3xl bg-aws-blue-light/20 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-aws-navy">
          <Lightbulb className="h-5 w-5 text-aws-orange" />
          备考小技巧
        </h2>
        <ul className="space-y-2 text-sm text-aws-navy/85">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aws-orange" />
            <span>按分类刷题，先攻克高频考点（如 S3、EC2、VPC、IAM）。</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aws-orange" />
            <span>考前至少做 1～2 套完整模拟考，熟悉 130 分钟节奏。</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aws-orange" />
            <span>错题和收藏反复做，结合解析和百科术语一起记。</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aws-orange" />
            <span>时间分配约 2 分钟/题，留 10～15 分钟检查。</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
