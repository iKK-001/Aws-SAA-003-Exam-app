'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuestions, useGlossary } from '@/lib/DataContext';
import { useDrawer } from '@/lib/DrawerContext';
import {
  setProgress,
  addWrongId,
  getWrongIds,
  getFavoriteIds,
  toggleFavorite,
  getProgress,
  getPracticeState,
  setPracticeStateOrder,
  setPracticeStateTopic,
  clearPracticeStateOrder,
  clearPracticeStateTopic,
  getBestAnswerArray,
  isQuestionMultiple,
  getAnswerCount,
  isAnswerCorrect,
  getTodayPracticeCount,
  getMilestonesShown,
  setMilestoneShown,
  getMascotPhrasesEnabled,
  getNickname,
  getSoundEnabled,
} from '@/lib/data';
import { playCorrectSound, playWrongSound } from '@/lib/sound';
import { Heart, ChevronLeft, ChevronRight, ListOrdered, Shuffle, FolderOpen, BookOpen, Search, ArrowRight, LayoutGrid } from 'lucide-react';
import type { Question } from '@/lib/data';
import { PracticeSkeleton } from '@/components/Skeleton';
import { QuestionCard } from '@/components/QuestionCard';
import { AnswerSheet } from '@/components/AnswerSheet';
import { HighlightTerms } from '@/components/HighlightTerms';
import {
  explanationPhrases,
  idlePhrases,
  clickPhrases,
  getStreakTierText,
  getCorrectPhrase,
  getWrongPhrase,
  getHomeGreeting,
  pickRandom,
} from '@/lib/mascotPhrases';

type PracticeMode = 'order' | 'shuffle' | 'topic';

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter');
  const modeParam = searchParams.get('mode') as PracticeMode | null;
  const tagParam = searchParams.get('tag');
  const sampleParam = searchParams.get('sample');
  const sample = sampleParam ? Math.min(Math.max(1, parseInt(sampleParam, 10) || 5), 200) : null;
  const mode: PracticeMode | null = modeParam ?? (filter ? 'order' : null);
  const hasChosenMode = mode === 'order' || mode === 'shuffle' || mode === 'topic';

  const { questions, loading, error } = useQuestions();
  const { glossary } = useGlossary();
  const { openTermDrawer } = useDrawer();
  const glossaryTerms = glossary ? Object.keys(glossary) : [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [list, setList] = useState<Question[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [justAnsweredCorrect, setJustAnsweredCorrect] = useState<boolean | null>(null);
  const [mascotPhrase, setMascotPhrase] = useState<string | null>(null);
  const [mascotPhrasesEnabled, setMascotPhrasesEnabled] = useState(() => getMascotPhrasesEnabled());
  /** 题干/选项显示语言：中文 或 英文（有疑问时可切到英文看原题） */
  const [questionLang, setQuestionLang] = useState<'cn' | 'en'>('cn');
  /** 答题卡抽屉是否打开 */
  const [answerSheetOpen, setAnswerSheetOpen] = useState(false);

  useEffect(() => {
    const handler = () => setMascotPhrasesEnabled(getMascotPhrasesEnabled());
    window.addEventListener('mascot-phrases-toggled', handler);
    return () => window.removeEventListener('mascot-phrases-toggled', handler);
  }, []);

  const todayCount = getTodayPracticeCount();
  const practiceGreeting = getNickname()
    ? getHomeGreeting(getNickname())
    : ['今天也要加油呀 ✨', '每天进步一点点 🌱', '刷题人，冲！💪', '越刷越顺手 🎯'][
        new Date().getDate() % 4
      ];

  /** 上位概念：取标签第一个词作为分类（如 ALB Health Checks → ALB） */
  const tagToRoot = (tag: string) => tag.trim().split(/\s+/)[0] || tag;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => q.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  /** 按上位概念合并后的分类：root → 题目数 */
  const rootCounts = useMemo(() => {
    const map: Record<string, number> = {};
    questions.forEach((q) => {
      const roots = new Set<string>();
      q.tags?.forEach((t) => roots.add(tagToRoot(t)));
      roots.forEach((r) => {
        map[r] = (map[r] || 0) + 1;
      });
    });
    return map;
  }, [questions]);

  /** 合并后的分类列表（上位概念），按名称排序 */
  /** 按题目数量从多到少排序，优先刷出题频繁的考点 */
  const sortedRoots = useMemo(
    () =>
      Object.keys(rootCounts).sort(
        (a, b) => (rootCounts[b] ?? 0) - (rootCounts[a] ?? 0)
      ),
    [rootCounts]
  );

  useEffect(() => {
    if (!questions.length || !hasChosenMode) return;
    let base: Question[] = [];
    if (filter === 'wrong') {
      const wrongIds = getWrongIds();
      base = questions.filter((q) => wrongIds.includes(q.id));
    } else if (filter === 'favorite') {
      const favIds = getFavoriteIds();
      base = questions.filter((q) => favIds.includes(q.id));
    } else {
      base = questions;
    }

    if (mode === 'topic' && tagParam) {
      base = base.filter((q) =>
        q.tags?.some((t) => t === tagParam || t.startsWith(tagParam + ' '))
      );
    }

    if (sample != null && sample > 0 && base.length > 0) {
      base = shuffleArray(base).slice(0, Math.min(sample, base.length));
    }

    if (mode === 'order' || mode === 'topic') {
      setList([...base].sort((a, b) => a.id - b.id));
      const total = base.length;
      if (total === 0) {
        setIndex(0);
        setSelected([]);
        setShowExplanation(false);
        return;
      }
      const state = getPracticeState();
      const saved =
        mode === 'order'
          ? state.order
          : mode === 'topic' && tagParam
            ? state.topic?.[tagParam]
            : null;
      const resumable =
        saved &&
        saved.total === total &&
        saved.index > 0 &&
        saved.index < saved.total;
      if (resumable) {
        setIndex(saved!.index);
        setToastMessage(`已从第 ${saved!.index + 1} 题继续`);
        setTimeout(() => setToastMessage(null), 2500);
      } else {
        setIndex(0);
      }
      setSelected([]);
      setShowExplanation(false);
    } else {
      setList(shuffleArray(base));
      setIndex(0);
      setSelected([]);
      setShowExplanation(false);
    }
  }, [questions, filter, mode, tagParam, hasChosenMode, sample]);

  useEffect(() => {
    if (!list.length) return;
    if (mode === 'order') setPracticeStateOrder(index, list.length);
    else if (mode === 'topic' && tagParam)
      setPracticeStateTopic(tagParam, index, list.length);
  }, [index, list.length, mode, tagParam]);

  const setMode = (m: PracticeMode, tag?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', m);
    if (tag) params.set('tag', tag);
    else params.delete('tag');
    const qs = params.toString();
    router.replace(qs ? `/practice?${qs}` : '/practice', { scroll: false });
  };

  const q = list[index];
  const isFavorite = q ? getFavoriteIds().includes(q.id) : false;
  const isMultiple = q ? isQuestionMultiple(q) : false;
  const answerCount = q ? getAnswerCount(q) : 1;

  const handleSelect = (key: string) => {
    if (!q) return;
    if (showExplanation) return;
    if (isMultiple) {
      const next = selected.includes(key)
        ? selected.filter((x) => x !== key)
        : [...selected, key];
      setSelected(next);
      if (next.length === answerCount) {
        const correct = isAnswerCorrect(q, next);
        setProgress(q.id, next.join(','), correct);
        if (!correct) addWrongId(q.id);
        setCorrectStreak((c) => (correct ? c + 1 : 0));
        setJustAnsweredCorrect(correct);
        setMascotPhrase(correct ? getCorrectPhrase(getNickname()) : getWrongPhrase(getNickname()));
        if (getSoundEnabled()) (correct ? playCorrectSound : playWrongSound)();
        setShowExplanation(true);
        setTimeout(() => setJustAnsweredCorrect(null), 1500);
        setTimeout(() => {
          const total = Object.keys(getProgress()).length;
          const shown = getMilestonesShown();
          if (total >= 10 && !shown[10]) {
            setMilestoneShown(10);
            setToastMessage('完成 10 题！🌟');
            setTimeout(() => setToastMessage(null), 2500);
          } else if (total >= 50 && !shown[50]) {
            setMilestoneShown(50);
            setToastMessage('半百达成！👏');
            setTimeout(() => setToastMessage(null), 2500);
          }
        }, 1600);
      }
    } else {
      setSelected([key]);
      const correct = isAnswerCorrect(q, key);
      setProgress(q.id, key, correct);
      if (!correct) addWrongId(q.id);
      setCorrectStreak((c) => (correct ? c + 1 : 0));
      setJustAnsweredCorrect(correct);
      setMascotPhrase(correct ? getCorrectPhrase(getNickname()) : getWrongPhrase(getNickname()));
      if (getSoundEnabled()) (correct ? playCorrectSound : playWrongSound)();
      setShowExplanation(true);
      setTimeout(() => setJustAnsweredCorrect(null), 1500);
      setTimeout(() => {
        const total = Object.keys(getProgress()).length;
        const shown = getMilestonesShown();
        if (total >= 10 && !shown[10]) {
          setMilestoneShown(10);
          setToastMessage('完成 10 题！🌟');
          setTimeout(() => setToastMessage(null), 2500);
        } else if (total >= 50 && !shown[50]) {
          setMilestoneShown(50);
          setToastMessage('半百达成！👏');
          setTimeout(() => setToastMessage(null), 2500);
        }
      }, 1600);
    }
  };

  const handleNext = () => {
    const isLastQuestion = index === list.length - 1;
    setSelected([]);
    setShowExplanation(false);
    setMascotPhrase(null);
    setIndex((i) => (i + 1) % list.length);
    if (isLastQuestion && list.length > 0) {
      const completionMessage =
        mode === 'topic' && tagParam
          ? `${tagParam} 全部刷完！🎉`
          : '本组题目全部刷完！🎉';
      setToastMessage(completionMessage);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handlePrev = () => {
    setSelected([]);
    setShowExplanation(false);
    setMascotPhrase(null);
    setIndex((i) => (i - 1 + list.length) % list.length);
  };

  if (loading) {
    return <PracticeSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">{error}</p>
      </div>
    );
  }

  if (!hasChosenMode) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <h2 className="mb-2 text-lg font-semibold text-aws-navy">选择刷题方式</h2>
        <p className="mb-6 text-sm text-aws-navy/60">
          先选择一种方式再开始做题 · 共 {questions.length} 题
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode('order')}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <ListOrdered className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-aws-navy">顺序刷题</p>
              <p className="text-sm text-aws-navy/60">按题目 ID 从第 1 题开始依次练习</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('shuffle')}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <Shuffle className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-aws-navy">乱序刷题</p>
              <p className="text-sm text-aws-navy/60">随机打乱题目顺序</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('topic')}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-card active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-aws-blue-light/50 text-aws-blue-deep">
              <FolderOpen className="h-6 w-6" />
            </span>
            <div>
              <p className="font-medium text-aws-navy">按分类刷题</p>
              <p className="text-sm text-aws-navy/60">先选考点（如 S3、ALB）再做题</p>
            </div>
          </button>
        </div>
        {filter && (
          <p className="mt-4 text-center text-xs text-aws-navy/50">
            {filter === 'wrong' ? '当前将只练习错题' : '当前将只练习收藏题'}
          </p>
        )}
      </div>
    );
  }

  if (mode === 'topic' && !tagParam) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="mb-4 text-sm text-aws-navy/60">选择考点（以上位概念归类）后开始刷题</p>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('order')}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-soft"
          >
            <ListOrdered className="h-4 w-4" /> 顺序
          </button>
          <button
            type="button"
            onClick={() => setMode('shuffle')}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-soft"
          >
            <Shuffle className="h-4 w-4" /> 乱序
          </button>
          <button
            type="button"
            onClick={() => setMode('topic')}
            className="flex items-center gap-2 rounded-2xl bg-aws-blue-light/50 px-4 py-2 font-medium text-aws-blue-deep"
          >
            <FolderOpen className="h-4 w-4" /> 按分类
          </button>
        </div>
        <ul className="space-y-2">
          {sortedRoots.map((root) => {
            const totalForRoot = rootCounts[root] ?? 0;
            const doneForRoot = questions.filter((q) =>
              q.tags?.some((t) => t === root || t.startsWith(root + ' '))
            ).filter((q) => getProgress()[q.id]).length;
            const percent = totalForRoot > 0 ? Math.round((doneForRoot / totalForRoot) * 100) : 0;
            return (
              <li key={root}>
                <button
                  type="button"
                  onClick={() => setMode('topic', root)}
                  className="w-full rounded-2xl bg-white p-4 text-left shadow-soft hover:shadow-card"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-aws-blue-deep">{root}</span>
                    <span className="text-sm text-aws-navy/60">
                      共 {totalForRoot} 题
                      {totalForRoot > 0 && (
                        <span className="ml-1 font-medium text-aws-orange">
                          {percent}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-aws-blue-light/30">
                    <div
                      className="h-full rounded-full bg-aws-orange transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {doneForRoot > 0 && (
                    <p className="mt-1 text-xs text-aws-navy/60">
                      已做 {doneForRoot} / {totalForRoot} 题
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!list.length) {
    const emptyMessage = filter === 'wrong'
      ? '暂无错题'
      : filter === 'favorite'
        ? '暂无收藏题'
        : mode === 'topic'
          ? '该分类暂无题目'
          : '暂无题目';
    const emptyHint = filter === 'wrong' || filter === 'favorite'
      ? '多做练习后错题和收藏会出现在这里'
      : null;
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aws-blue-light/40 text-aws-blue-deep">
          <BookOpen className="h-7 w-7" />
        </span>
        <p className="text-aws-navy/80 font-medium">{emptyMessage}</p>
        {emptyHint && <p className="text-sm text-aws-navy/60">{emptyHint}</p>}
        <Link
          href="/practice"
          className="rounded-2xl bg-aws-blue-deep px-4 py-3 text-sm font-medium text-white"
        >
          去练习
        </Link>
        {mode === 'topic' && tagParam && (
          <button
            type="button"
            onClick={() => setMode('topic')}
            className="text-sm text-aws-blue-deep"
          >
            返回选择分类
          </button>
        )}
      </div>
    );
  }

  const options =
    questionLang === 'en' && q.options_en
      ? Object.entries(q.options_en)
      : q.options_cn
        ? Object.entries(q.options_cn)
        : [];
  const questionDisplayText =
    questionLang === 'en' ? (q.question_en ?? q.question_cn) : q.question_cn;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <p className="mb-3 text-sm text-aws-navy/70">
        <span className="font-medium text-aws-orange">今日已练 {todayCount} 题</span>
        {' · '}
        <span className="text-aws-navy/80">{practiceGreeting}</span>
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('order')}
          aria-label="按顺序刷题"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${mode === 'order' ? 'bg-aws-blue-deep text-white' : 'bg-white text-aws-navy shadow-soft'}`}
        >
          <ListOrdered className="h-4 w-4" /> 顺序
        </button>
        <button
          type="button"
          onClick={() => setMode('shuffle')}
          aria-label="乱序刷题"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${mode === 'shuffle' ? 'bg-aws-blue-deep text-white' : 'bg-white text-aws-navy shadow-soft'}`}
        >
          <Shuffle className="h-4 w-4" /> 乱序
        </button>
        <button
          type="button"
          onClick={() => setMode('topic')}
          aria-label="按分类刷题"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm ${mode === 'topic' ? 'bg-aws-blue-deep text-white' : 'bg-white text-aws-navy shadow-soft'}`}
        >
          <FolderOpen className="h-4 w-4" /> 按分类
        </button>
        {mode === 'topic' && tagParam && (
          <span className="rounded-xl bg-aws-blue-light/40 px-3 py-2 text-sm text-aws-blue-deep">
            {tagParam}
          </span>
        )}
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-aws-navy/60">
          {filter === 'wrong' ? '正在练习：错题本' : filter === 'favorite' ? '正在练习：收藏' : '正在练习：全部题目'}
          {' · 共 '}{list.length} 题
        </p>
        <div className="flex items-center gap-1 rounded-xl bg-aws-blue-light/30 p-1">
          <button
            type="button"
            onClick={() => setQuestionLang('cn')}
            aria-label="题干选项显示中文"
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${questionLang === 'cn' ? 'bg-aws-blue-deep text-white' : 'text-aws-navy/70 hover:bg-aws-blue-deep/10'}`}
          >
            中文
          </button>
          <button
            type="button"
            onClick={() => setQuestionLang('en')}
            aria-label="题干选项显示英文"
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${questionLang === 'en' ? 'bg-aws-blue-deep text-white' : 'text-aws-navy/70 hover:bg-aws-blue-deep/10'}`}
          >
            EN
          </button>
        </div>
      </div>
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-aws-blue-light/30">
        <div
          className="h-full rounded-full bg-aws-blue-deep transition-[width] duration-200"
          style={{ width: `${list.length ? ((index + 1) / list.length) * 100 : 0}%` }}
        />
      </div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-aws-navy/60">
          {index + 1} / {list.length}
          {correctStreak >= 1 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              🔥 连续 {correctStreak} 题
            </span>
          )}
          {index > 0 && (
            <button
              type="button"
              onClick={() => {
                if (mode === 'order') clearPracticeStateOrder();
                else if (mode === 'topic' && tagParam)
                  clearPracticeStateTopic(tagParam);
                setIndex(0);
                setSelected([]);
                setShowExplanation(false);
                setMascotPhrase(null);
                setToastMessage('已从第一题开始');
                setTimeout(() => setToastMessage(null), 2000);
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-aws-orange hover:bg-aws-orange/10"
            >
              从第一题开始
            </button>
          )}
          <button
            type="button"
            onClick={() => setAnswerSheetOpen(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-aws-blue-deep hover:bg-aws-blue-light/50"
            aria-label="打开答题卡"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> 答题卡
          </button>
        </span>
        <button
          type="button"
          onClick={() => {
            if (!q) return;
            const added = toggleFavorite(q.id);
            setToastMessage(added ? '已加入收藏' : '已取消收藏');
            setTimeout(() => setToastMessage(null), 2000);
          }}
          className={`rounded-2xl p-2 ${isFavorite ? 'text-red-500' : 'text-aws-navy/40'}`}
          aria-label={isFavorite ? '取消收藏' : '收藏'}
        >
          <Heart className={`h-5 w-5 -rotate-12 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <QuestionCard
        question={q}
        questionText={questionDisplayText}
        options={options}
        selected={selected}
        showExplanation={showExplanation}
        isMultiple={isMultiple}
        answerCount={answerCount}
        correctStreak={correctStreak}
        justAnsweredCorrect={justAnsweredCorrect}
        idlePhrase={mascotPhrasesEnabled && list.length ? idlePhrases[index % idlePhrases.length] : undefined}
        onMascotClick={() => {
          setToastMessage(pickRandom(clickPhrases));
          setTimeout(() => setToastMessage(null), 2800);
        }}
        getBestAnswerArray={getBestAnswerArray}
        onSelect={handleSelect}
        onTermClick={openTermDrawer}
      />

      {showExplanation && (
        <div
          className={`mt-4 rounded-2xl border-b-4 px-4 py-3 text-center shadow-float ${
            isAnswerCorrect(q, isMultiple ? selected : selected[0] ?? '')
              ? 'bg-emerald-100 text-emerald-700 border-emerald-400'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="text-base font-semibold">
            {isAnswerCorrect(q, isMultiple ? selected : selected[0] ?? '')
              ? '太棒啦！✨'
              : '没关系，下次一定行！💪'}
          </p>
          {isAnswerCorrect(q, isMultiple ? selected : selected[0] ?? '') && getStreakTierText(correctStreak) && (
            <p className="mt-1 text-sm font-medium opacity-90">
              {getStreakTierText(correctStreak)}
            </p>
          )}
          {mascotPhrasesEnabled && mascotPhrase && (
            <p className="mt-2 text-xs text-aws-navy/70">
              小助手：{mascotPhrase}
            </p>
          )}
        </div>
      )}

      {showExplanation && q.explanation && (
        <div
          className="mt-6 rounded-3xl border-2 border-aws-navy/5 bg-aws-blue-light/20 p-4 shadow-float border-b-4 border-b-aws-blue-deep/30"
          role="region"
          aria-live="polite"
          aria-label="题目解析"
        >
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-aws-blue-deep">
            <Search className="h-4 w-4 -rotate-6" aria-hidden />
            看透真相 🔍
          </p>
          {mascotPhrasesEnabled && (
            <p className="mb-3 rounded-xl bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-800">
              小助手：{explanationPhrases[q.id % explanationPhrases.length]}
            </p>
          )}
          <p className="mb-4 text-xs text-aws-navy/90 leading-relaxed">
            <HighlightTerms
              text={q.explanation.analysis}
              terms={[...new Set([...(q.related_terms ?? []), ...glossaryTerms])]}
              onTermClick={openTermDrawer}
              className="text-aws-navy/90"
            />
          </p>
          <div className="mb-4 border-l-4 border-green-500/70 bg-green-50/50 pl-3 pr-2 py-2 rounded-r-xl">
            <p className="mb-1 text-xs font-semibold text-aws-navy">✅ 原来如此</p>
            <p className="text-xs text-aws-navy/90 leading-relaxed">
              <HighlightTerms
                text={q.explanation.why_correct}
                terms={[...new Set([...(q.related_terms ?? []), ...glossaryTerms])]}
                onTermClick={openTermDrawer}
                className="text-aws-navy/90"
              />
            </p>
          </div>
          {q.explanation.why_wrong ? (
            <div className="border-l-4 border-amber-400/70 bg-amber-50/50 pl-3 pr-2 py-2 rounded-r-xl">
              <p className="mb-1 text-xs font-semibold text-aws-navy">💡 记住这点</p>
              <p className="text-xs text-aws-navy/90 leading-relaxed whitespace-pre-wrap">
                <HighlightTerms
                  text={q.explanation.why_wrong}
                  terms={[...new Set([...(q.related_terms ?? []), ...glossaryTerms])]}
                  onTermClick={openTermDrawer}
                  className="text-aws-navy/90"
                />
              </p>
            </div>
          ) : null}
        </div>
      )}

      <AnswerSheet
        open={answerSheetOpen}
        onClose={() => setAnswerSheetOpen(false)}
        list={list}
        currentIndex={index}
        onSelectIndex={(i) => {
          setIndex(i);
          setSelected([]);
          setShowExplanation(false);
          setMascotPhrase(null);
        }}
        onClearProgress={() => {
          if (mode === 'order') clearPracticeStateOrder();
          else if (mode === 'topic' && tagParam)
            clearPracticeStateTopic(tagParam);
          setIndex(0);
          setSelected([]);
          setShowExplanation(false);
          setMascotPhrase(null);
          setToastMessage('已从第一题开始');
          setTimeout(() => setToastMessage(null), 2000);
        }}
      />

      {toastMessage && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-aws-navy px-4 py-2.5 text-sm text-white shadow-card transition-opacity duration-200"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="上一题"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 shadow-float active:scale-[0.99]"
        >
          <ChevronLeft className="h-5 w-5 rotate-[-8deg] text-aws-navy" />
          <span className="text-sm font-medium text-aws-navy">上一题</span>
        </button>
        <button
          type="button"
          onClick={handleNext}
          aria-label="下一题"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-aws-orange py-3 text-white shadow-float active:scale-[0.99]"
        >
          <span className="text-sm font-medium">继续冒险</span>
          <ArrowRight className="h-5 w-5 rotate-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="min-h-safe" />}>
      <PracticeContent />
    </Suspense>
  );
}
