'use client';

import { useRouter } from 'next/navigation';
import { useQuestions } from '@/lib/DataContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Send, Check } from 'lucide-react';
import type { Question } from '@/lib/data';
import { getBestAnswerArray, isQuestionMultiple, getAnswerCount, isAnswerCorrect } from '@/lib/data';

const MOCK_COUNT = 65;
const MOCK_DURATION_SECONDS = 130 * 60; // 130 分钟
const MOCK_RESULT_KEY = 'aws-mock-result';

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type MockResult = {
  score: number;
  total: number;
  correctCount: number;
  wrongIds: number[];
  timeSpentSeconds: number;
};

export default function MockRunPage() {
  const router = useRouter();
  const { questions, loading } = useQuestions();
  const [list, setList] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(MOCK_DURATION_SECONDS);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // 进入页面时抽题（只执行一次）
  useEffect(() => {
    if (!questions.length) return;
    const shuffled = shuffleArray(questions).slice(0, MOCK_COUNT);
    setList(shuffled);
    setStartedAt(Date.now());
  }, [questions.length]);

  // 倒计时（用 ref 调用交卷，避免因 answers 变化导致定时器重建）
  useEffect(() => {
    if (submitted || list.length === 0 || startedAt == null) return;
    const endAt = startedAt + MOCK_DURATION_SECONDS * 1000;
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((endAt - now) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) submitRef.current();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [list.length, startedAt, submitted]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    const unanswered = list.length - Object.keys(answers).length;
    const message =
      unanswered > 0
        ? `还有 ${unanswered} 题未作答，确定交卷吗？交卷后将显示得分与错题。`
        : '确定交卷吗？交卷后将显示得分与错题。';
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    setSubmitted(true);
    let correctCount = 0;
    const wrongIds: number[] = [];
    list.forEach((q) => {
      const chosen = answers[q.id];
      if (!chosen) return;
      const userAnswer = chosen.includes(',') ? chosen.split(',').map((s) => s.trim()).filter(Boolean) : chosen;
      if (isAnswerCorrect(q, userAnswer)) correctCount++;
      else wrongIds.push(q.id);
    });
    const timeSpentSeconds = startedAt
      ? Math.round((Date.now() - startedAt) / 1000)
      : 0;
    const result: MockResult = {
      score: correctCount,
      total: list.length,
      correctCount,
      wrongIds,
      timeSpentSeconds,
    };
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MOCK_RESULT_KEY, JSON.stringify(result));
    }
    router.push('/mock/result');
  }, [submitted, list, answers, startedAt, router]);

  const setAnswer = useCallback((questionId: number, optionKey: string, isMultiple: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? '';
      if (!isMultiple) return { ...prev, [questionId]: optionKey };
      const arr = current ? current.split(',').map((s) => s.trim()).filter(Boolean) : [];
      const next = arr.includes(optionKey) ? arr.filter((x) => x !== optionKey) : [...arr, optionKey];
      return { ...prev, [questionId]: next.join(',') };
    });
  }, []);

  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-safe items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-aws-blue-deep border-t-transparent" />
      </div>
    );
  }

  if (!list.length && !questions.length) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">暂无题目，请先准备题库数据。</p>
        <button
          type="button"
          onClick={() => router.push('/mock')}
          className="rounded-2xl bg-aws-blue-deep px-4 py-3 text-white"
        >
          返回模拟考
        </button>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex min-h-safe items-center justify-center p-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-aws-blue-deep border-t-transparent" />
      </div>
    );
  }

  const q = list[index];
  const options = q.options_cn ? Object.entries(q.options_cn) : [];
  const chosenRaw = answers[q.id];
  const isMultiple = isQuestionMultiple(q);
  const answerCount = getAnswerCount(q);
  const chosenArr = chosenRaw ? chosenRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = index === list.length - 1;
  const needMore = isMultiple && chosenArr.length < answerCount;

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      {/* 顶部：倒计时 + 题号 + 交卷 */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-aws-blue-light/50 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span
            className={`rounded-xl px-3 py-1.5 text-sm font-mono font-medium ${
              remainingSeconds <= 300
                ? 'bg-red-100 text-red-700'
                : 'bg-aws-blue-light/50 text-aws-blue-deep'
            }`}
          >
            {formatTime(remainingSeconds)}
          </span>
          <span className="text-sm text-aws-navy/60">
            {index + 1} / {list.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-aws-blue-light/30">
          <div
            className="h-full rounded-full bg-aws-blue-deep transition-[width] duration-300"
            style={{
              width: `${(remainingSeconds / MOCK_DURATION_SECONDS) * 100}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/mock')}
            className="rounded-xl border border-aws-navy/20 bg-white px-4 py-2 text-sm font-medium text-aws-navy/80 hover:bg-aws-blue-light/30"
          >
            放弃
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-xl bg-aws-orange px-4 py-2 text-sm font-medium text-white hover:opacity-95"
          >
            <Send className="h-4 w-4" />
            交卷
          </button>
        </div>
      </div>

      {/* 题干 */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-card">
        {isMultiple && (
          <p className="mb-2 text-xs font-medium text-aws-orange">
            多选题 · 需选 {answerCount} 项
          </p>
        )}
        <p className="whitespace-pre-wrap text-aws-navy">{q.question_cn}</p>
      </div>

      {isMultiple && needMore && (
        <p className="mb-3 rounded-xl bg-aws-orange/15 px-3 py-2 text-sm font-medium text-aws-orange">
          请再选择 {answerCount - chosenArr.length} 项
        </p>
      )}

      {/* 选项 */}
      <ul className="space-y-3">
        {options.map(([key, text]) => {
          const isChosen = chosenArr.includes(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setAnswer(q.id, key, isMultiple)}
                aria-label={`选项 ${key}`}
                aria-pressed={isChosen}
                aria-checked={isMultiple ? isChosen : undefined}
                className={`flex w-full items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                  isChosen
                    ? 'border-aws-blue-deep bg-aws-blue-light/30'
                    : 'border-aws-blue-light/50 bg-white hover:border-aws-blue-deep/50'
                }`}
              >
                {isMultiple && (
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      isChosen ? 'border-aws-blue-deep bg-aws-blue-deep' : 'border-aws-navy/30'
                    }`}
                    aria-hidden
                  >
                    {isChosen && <Check className="h-3 w-3 text-white" />}
                  </span>
                )}
                <span className="font-medium text-aws-navy">{key}. </span>
                <span className="text-aws-navy">{text}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* 上一题 / 下一题 */}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="上一题"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 shadow-soft disabled:opacity-50 active:scale-[0.99]"
        >
          <ChevronLeft className="h-5 w-5 text-aws-navy" />
          <span className="text-sm font-medium text-aws-navy">上一题</span>
        </button>
        <button
          type="button"
          onClick={() =>
            isLastQuestion ? handleSubmit() : setIndex((i) => i + 1)
          }
          aria-label={isLastQuestion ? '交卷' : '下一题'}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-aws-blue-deep py-3 text-white shadow-soft active:scale-[0.99]"
        >
          <span className="text-sm font-medium">
            {isLastQuestion ? '交卷' : '下一题'}
          </span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-aws-navy/50">
        已答 {answeredCount} / {list.length} 题
      </p>
    </div>
  );
}
