'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getProgress,
  getWrongIds,
  getFavoriteIds,
  getFavoriteTerms,
  getExamDateTarget,
  setExamDateTarget,
  getNickname,
  setNickname,
  getMascotPhrasesEnabled,
  setMascotPhrasesEnabled,
  getTheme,
  setTheme,
  getSoundEnabled,
  setSoundEnabled,
  clearAllLocalData,
} from '@/lib/data';
import type { ThemeId } from '@/lib/data';
import { useDrawer } from '@/lib/DrawerContext';
import { useGlossary } from '@/lib/DataContext';
import { Target, BookOpen, Heart, XCircle, Star, ChevronRight, User, MessageCircle, Layers, Info, Trash2 } from 'lucide-react';

const MASCOT_PHRASES_TOGGLED = 'mascot-phrases-toggled';

export default function ProfilePage() {
  const router = useRouter();
  const [examDate, setExamDate] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [mascotPhrasesOn, setMascotPhrasesOn] = useState(true);
  const [theme, setThemeState] = useState<ThemeId>('relaxed');
  const [soundOn, setSoundOn] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [favTerms, setFavTerms] = useState<string[]>([]);
  const { openTermDrawer } = useDrawer();
  const { glossary } = useGlossary();

  useEffect(() => {
    setMounted(true);
    setExamDate(getExamDateTarget());
    setNicknameInput(getNickname());
    setMascotPhrasesOn(getMascotPhrasesEnabled());
    setThemeState(getTheme());
    setSoundOn(getSoundEnabled());
    setFavTerms(getFavoriteTerms());
  }, []);

  const handleSaveNickname = () => {
    const name = nicknameInput.trim().slice(0, 20);
    setNickname(name);
    setNicknameInput(name);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleMascotToggle = () => {
    const next = !mascotPhrasesOn;
    setMascotPhrasesEnabled(next);
    setMascotPhrasesOn(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MASCOT_PHRASES_TOGGLED));
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-safe items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-aws-blue-deep border-t-transparent" />
      </div>
    );
  }

  const progress = getProgress();
  const done = Object.keys(progress).length;
  const correct = Object.values(progress).filter((v) => v.correct).length;
  const wrongCount = getWrongIds().length;
  const favCount = getFavoriteIds().length;

  const handleSaveDate = () => {
    setExamDateTarget(examDate);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-aws-navy">
          <User className="h-5 w-5 text-aws-blue-deep" />
          我的昵称
        </h2>
        <p className="mb-3 text-xs text-aws-navy/60">
          设置后，小助手会喊你的昵称，首页也会显示招呼哦
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            placeholder="输入昵称（如：小红）"
            maxLength={20}
            className="flex-1 rounded-2xl border border-aws-blue-light/50 bg-aws-slate-soft px-4 py-3 text-aws-navy placeholder:text-aws-navy/40 focus:border-aws-blue-deep focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveNickname}
            className="rounded-2xl bg-aws-orange px-4 py-3 font-medium text-white shadow-soft active:scale-[0.98]"
          >
            保存
          </button>
        </div>
        {savedToast && (
          <p className="mt-2 text-xs font-medium text-emerald-600">昵称已保存～</p>
        )}
      </section>

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-aws-navy">
          <MessageCircle className="h-5 w-5 text-aws-blue-deep" />
          小助手设置
        </h2>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-aws-blue-light/20 py-3 pr-2">
          <span className="text-sm text-aws-navy/90">做题时显示小助手陪伴语</span>
          <button
            type="button"
            role="switch"
            aria-checked={mascotPhrasesOn}
            onClick={handleMascotToggle}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              mascotPhrasesOn ? 'bg-aws-orange' : 'bg-aws-navy/20'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                mascotPhrasesOn ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </label>
        <p className="mt-2 text-xs text-aws-navy/60">关闭后，做题页不再显示「小助手：xxx」等文案</p>
      </section>

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-aws-navy">
          <Info className="h-5 w-5 text-aws-blue-deep" /> 关于
        </h2>
        <p className="mb-4 text-sm text-aws-navy/70">
          AWS SAA 备考 App，支持按题练习、按分类刷题、百科词库与错题/收藏。数据仅存于本机，可随时清除。
        </p>
        <h3 className="mb-2 text-sm font-medium text-aws-navy/90">主题 / 皮肤</h3>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setTheme('relaxed'); setThemeState('relaxed'); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              theme === 'relaxed' ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-400' : 'bg-aws-navy/10 text-aws-navy/80 hover:bg-aws-navy/20'
            }`}
          >
            轻松
          </button>
          <button
            type="button"
            onClick={() => { setTheme('focus'); setThemeState('focus'); }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
              theme === 'focus' ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400' : 'bg-aws-navy/10 text-aws-navy/80 hover:bg-aws-navy/20'
            }`}
          >
            专注
          </button>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-aws-blue-light/20 py-3 pr-2">
          <span className="text-sm text-aws-navy/90">答对 / 答错音效</span>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={() => { const next = !soundOn; setSoundEnabled(next); setSoundOn(next); }}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${soundOn ? 'bg-aws-orange' : 'bg-aws-navy/20'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${soundOn ? 'left-6' : 'left-1'}`} />
          </button>
        </label>
      </section>

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-aws-navy">内容与记忆</h2>
        <Link
          href="/glossary/flashcard"
          className="mb-3 flex items-center justify-between rounded-2xl bg-aws-blue-light/30 p-4 transition-colors hover:bg-aws-blue-light/50 active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-aws-blue-deep" />
            <span className="font-medium text-aws-navy">随机抽一个术语（抽认卡）</span>
          </span>
          <ChevronRight className="h-5 w-5 text-aws-navy/40" />
        </Link>
        <div className="flex flex-col gap-2">
          <Link
            href="/practice?filter=wrong&mode=order&sample=5"
            className="flex items-center justify-between rounded-2xl bg-aws-blue-light/30 p-4 transition-colors hover:bg-aws-blue-light/50 active:scale-[0.99]"
          >
            <span className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-aws-navy/70" />
              <span className="font-medium text-aws-navy">错题本 · 随机抽 5 题再练</span>
            </span>
            <ChevronRight className="h-5 w-5 text-aws-navy/40" />
          </Link>
          <Link
            href="/practice?filter=favorite&mode=order&sample=5"
            className="flex items-center justify-between rounded-2xl bg-aws-blue-light/30 p-4 transition-colors hover:bg-aws-blue-light/50 active:scale-[0.99]"
          >
            <span className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-red-400" />
              <span className="font-medium text-aws-navy">收藏题 · 随机抽 5 题再练</span>
            </span>
            <ChevronRight className="h-5 w-5 text-aws-navy/40" />
          </Link>
        </div>
      </section>

      <section className="mb-6 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-aws-navy">
          <Target className="h-5 w-5 text-aws-blue-deep" />
          考试日期目标
        </h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            onBlur={handleSaveDate}
            className="flex-1 rounded-2xl border border-aws-blue-light/50 bg-aws-slate-soft px-4 py-3 text-aws-navy focus:border-aws-blue-deep focus:outline-none"
          />
        </div>
        <p className="mt-2 text-xs text-aws-navy/60">选择后自动保存到本地</p>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-semibold text-aws-navy">学习数据</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-2xl bg-aws-blue-light/30 p-3">
            <BookOpen className="h-8 w-8 text-aws-blue-deep" />
            <div>
              <p className="text-xl font-bold text-aws-navy">{done}</p>
              <p className="text-xs text-aws-navy/70">已做题</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-aws-blue-light/30 p-3">
            <span className="text-2xl font-bold text-aws-blue-deep">
              {done ? Math.round((correct / done) * 100) : 0}%
            </span>
            <div>
              <p className="text-xs text-aws-navy/70">正确率</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-aws-blue-light/30 p-3">
            <XCircle className="h-8 w-8 text-aws-navy/70" />
            <div>
              <p className="text-xl font-bold text-aws-navy">{wrongCount}</p>
              <p className="text-xs text-aws-navy/70">错题数</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-aws-blue-light/30 p-3">
            <Heart className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-xl font-bold text-aws-navy">{favCount}</p>
              <p className="text-xs text-aws-navy/70">收藏题数</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-red-200 bg-red-50/50 p-5 shadow-card">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-aws-navy">
          <Trash2 className="h-4 w-4 text-red-600" /> 清除本地数据
        </h2>
        <p className="mb-3 text-xs text-aws-navy/70">
          将清除做题进度、错题、收藏题、收藏术语、考试日期目标。操作不可恢复。
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {}}
            className="rounded-xl border border-aws-navy/20 bg-white px-4 py-2 text-sm font-medium text-aws-navy/80 hover:bg-aws-blue-light/30"
          >
            暂不
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.confirm('确定清除全部本地数据吗？做题进度、错题、收藏、考试日期、收藏术语将全部清空。')) {
                clearAllLocalData();
                router.refresh();
              }
            }}
            className="rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            确定清除
          </button>
        </div>
      </section>

      {favTerms.length > 0 && (
        <section className="mt-6 rounded-3xl bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-aws-navy">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            收藏的术语
          </h2>
          <p className="mb-3 text-sm text-aws-navy/60">共 {favTerms.length} 个 · 点击可查看解释</p>
          <ul className="space-y-2">
            {favTerms.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => openTermDrawer(key)}
                  className="flex w-full items-center justify-between rounded-2xl bg-aws-blue-light/20 p-3 text-left transition-colors hover:bg-aws-blue-light/40"
                >
                  <span className="font-medium text-aws-blue-deep">{key}</span>
                  <ChevronRight className="h-5 w-5 text-aws-navy/40" />
                </button>
                {glossary?.[key] && (
                  <p className="mt-1 line-clamp-1 pl-3 text-xs text-aws-navy/60">
                    {glossary[key].definition}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Link
            href="/glossary"
            className="mt-3 block text-center text-sm font-medium text-aws-blue-deep"
          >
            前往百科全部词条
          </Link>
        </section>
      )}
    </div>
  );
}
