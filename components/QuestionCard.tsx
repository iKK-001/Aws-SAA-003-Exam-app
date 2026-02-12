'use client';

import { Check, X } from 'lucide-react';
import type { Question } from '@/lib/data';

type QuestionCardProps = {
  question: Question;
  /** 当前展示的题干（中或英），不传则用 question.question_cn */
  questionText?: string;
  options: [string, string][];
  selected: string[];
  showExplanation: boolean;
  isMultiple: boolean;
  answerCount: number;
  correctStreak: number;
  /** 刚答完：true=对 / false=错 / null=未刚答完，用于 mascot 短暂变化 */
  justAnsweredCorrect: boolean | null;
  /** 做题中（空闲）时 mascot 旁显示的一句小话 */
  idlePhrase?: string;
  /** 点击 mascot 时的彩蛋回调 */
  onMascotClick?: () => void;
  getBestAnswerArray: (q: Question) => string[];
  onSelect: (key: string) => void;
  onTermClick: (term: string) => void;
};

export function QuestionCard({
  question: q,
  questionText,
  options,
  selected,
  showExplanation,
  isMultiple,
  answerCount,
  correctStreak,
  justAnsweredCorrect,
  idlePhrase,
  onMascotClick,
  getBestAnswerArray,
  onSelect,
  onTermClick,
}: QuestionCardProps) {
  const bestArr = getBestAnswerArray(q);

  const mascotEmoji =
    justAnsweredCorrect === true
      ? '🎉'
      : justAnsweredCorrect === false
        ? '🤗'
        : showExplanation
          ? '🧐'
          : correctStreak >= 3
            ? '🥳'
            : '🤖';

  const showIdlePhrase = !showExplanation && idlePhrase;

  return (
    <div className="relative">
      {/* 角落 mascot（不再在旁加气泡，避免挡题干） */}
      <div className="absolute -top-1 -right-1 z-10">
        {onMascotClick ? (
          <button
            type="button"
            onClick={onMascotClick}
            className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white/90 text-2xl shadow-float-lavender transition-transform active:scale-95"
            aria-label="点击小助手"
          >
            {mascotEmoji}
          </button>
        ) : (
          <div
            className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white/90 text-2xl shadow-float-lavender"
            aria-hidden
          >
            {mascotEmoji}
          </div>
        )}
      </div>

      {/* 题目卡片：厚实底边 + 浮动阴影 */}
      <div className="mb-3 rounded-3xl border-2 border-aws-navy/5 bg-white p-4 pb-5 shadow-float border-b-4 border-b-aws-orange/40">
        {isMultiple && (
          <p className="mb-2 text-xs font-semibold text-aws-orange">
            多选题 · 需选 {answerCount} 项
          </p>
        )}
        <p className="whitespace-pre-wrap font-medium text-aws-navy pr-10">
          {questionText ?? q.question_cn}
        </p>
        {q.question_image && (
          <div className="mt-3 rounded-xl overflow-hidden border border-aws-navy/10 bg-aws-navy/5">
            <img
              src={q.question_image}
              alt="题目附图"
              className="w-full max-w-md mx-auto block"
            />
          </div>
        )}
      </div>

      {/* 空闲小话：题目下方、选项上方，不挡题干 */}
      {showIdlePhrase && (
        <p className="mb-3 rounded-2xl bg-violet-50/80 px-3 py-2 text-center text-xs text-violet-800/90">
          小助手：{idlePhrase}
        </p>
      )}

      {isMultiple && !showExplanation && selected.length < answerCount && (
        <p className="mb-3 rounded-2xl bg-orange-100 px-3 py-2 text-sm font-medium text-orange-700">
          请再选择 {answerCount - selected.length} 项
        </p>
      )}

      <ul className="space-y-3">
        {options.map(([key, text]) => {
          const isChosen = selected.includes(key);
          const isCorrect = bestArr.includes(key);
          const showRight = showExplanation && isCorrect;
          const showWrong = showExplanation && isChosen && !isCorrect;
          const disabled = showExplanation || (!isMultiple && selected.length > 0);
          const optionImg = q.options_image?.[key];

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(key)}
                disabled={disabled}
                aria-label={`选项 ${key}`}
                aria-pressed={isChosen}
                aria-checked={isMultiple ? isChosen : undefined}
                className={`flex w-full items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.98] active:border-violet-500 ${
                  showWrong
                    ? 'border-red-400 bg-red-100 animate-shake'
                    : showRight
                      ? 'border-green-500 bg-emerald-100 scale-105 shadow-float-mint'
                      : isChosen
                        ? 'border-violet-400 bg-violet-50 shadow-float-lavender scale-[1.02]'
                        : 'border-violet-200 bg-white hover:border-violet-300 hover:bg-violet-50/80'
                }`}
              >
                {isMultiple && !showExplanation && (
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isChosen ? 'border-violet-500 bg-violet-500' : 'border-aws-navy/30'
                    }`}
                    aria-hidden
                  >
                    {isChosen && <Check className="h-3 w-3 text-white" />}
                  </span>
                )}
                {showRight && (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
                {showWrong && isChosen && (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                    <X className="h-3 w-3" aria-hidden />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-aws-navy">{key}. </span>
                  {optionImg ? (
                    <span className="block">
                      <img src={optionImg} alt={text} className="mt-1 max-h-32 w-auto rounded-lg border border-aws-navy/10 bg-white object-contain" />
                      <span className="mt-1 block text-xs text-aws-navy/70">{text}</span>
                    </span>
                  ) : (
                    <span className="text-aws-navy">{text}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {q.related_terms?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="mr-1 self-center text-xs text-aws-navy/50">关联词汇：</span>
          {[...new Set(q.related_terms)].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTermClick(t)}
              className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-200/80"
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
