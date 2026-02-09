export type Question = {
  id: number;
  question_cn: string;
  question_en?: string;
  options_cn: Record<string, string>;
  options_en?: Record<string, string>;
  /** 单选为 string，多选兼容格式为 string[] */
  best_answer: string | string[];
  official_answer?: string | string[];
  is_multiple?: boolean;
  answer_count?: number;
  tags?: string[];
  related_terms?: string[];
  explanation?: { analysis: string; why_correct: string; why_wrong: string };
};

/** 将 best_answer 规范为字符串数组（兼容旧数据 string / 多字母串如 "AB"） */
export function getBestAnswerArray(q: Question): string[] {
  const a = q.best_answer;
  if (Array.isArray(a)) return [...a].map((x) => String(x).trim().toUpperCase()).sort();
  if (a == null || a === '') return [];
  const s = String(a).trim().toUpperCase();
  // 多选旧数据常为 "AB"、"ACD" 等拼接串，需拆成 ["A","B"]
  if (s.length > 1) return [...s].sort();
  return [s];
}

/** 从题干推断需选数量（选二/选三/Select TWO 等），无匹配则返回 0 */
function inferAnswerCountFromQuestionText(question_cn: string | undefined): number {
  if (!question_cn || typeof question_cn !== 'string') return 0;
  const t = question_cn.trim();
  // 不用 \b：JS 里 \b 对中文无效，会导致「（选二）」等匹配失败
  if (/选二|选择两个|Select\s+TWO|选二。/i.test(t)) return 2;
  if (/选三|选择三个|Select\s+THREE|选三。/i.test(t)) return 3;
  return 0;
}

/** 是否多选题（含从题干推断：题干写「选二」等但数据未 refined 时也按多选） */
export function isQuestionMultiple(q: Question): boolean {
  if (q.is_multiple === true) return true;
  const fromData = getBestAnswerArray(q).length > 1;
  if (fromData) return true;
  const fromText = inferAnswerCountFromQuestionText(q.question_cn);
  return fromText > 1;
}

/** 正确项数量（多选需选够才可交卷；优先用数据，其次从题干推断） */
export function getAnswerCount(q: Question): number {
  if (q.answer_count != null && q.answer_count > 0) return q.answer_count;
  const fromText = inferAnswerCountFromQuestionText(q.question_cn);
  if (fromText > 0) return fromText;
  return getBestAnswerArray(q).length;
}

/** 判分：多选必须全部选对才得分，比较 sorted join */
export function isAnswerCorrect(q: Question, userAnswer: string | string[]): boolean {
  const best = getBestAnswerArray(q);
  const user = Array.isArray(userAnswer)
    ? [...userAnswer].map((x) => String(x).trim().toUpperCase()).sort()
    : userAnswer != null && userAnswer !== ''
      ? [String(userAnswer).trim().toUpperCase()]
      : [];
  if (best.length !== user.length) return false;
  return best.join('') === user.join('');
}

export type GlossaryEntry = {
  definition: string;
  analogy: string;
  features: string[];
};

export type Glossary = Record<string, GlossaryEntry>;

const STORAGE_KEYS = {
  progress: 'aws-exam-progress',
  wrong: 'aws-exam-wrong',
  favorite: 'aws-exam-favorite',
  examDate: 'aws-exam-date',
  favoriteTerms: 'aws-exam-favorite-terms',
  practiceState: 'aws-practice-state',
  mockHistory: 'aws-mock-history',
  todayPractice: 'aws-exam-today',
  milestones: 'aws-exam-milestones',
  mascotPhrases: 'aws-exam-mascot-phrases',
  nickname: 'aws-exam-nickname',
  theme: 'aws-exam-theme',
  sound: 'aws-exam-sound',
} as const;

export type ThemeId = 'relaxed' | 'focus';

/** 主题：relaxed 轻松（暖色）、focus 专注（冷色）。默认 relaxed */
export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return 'relaxed';
  const v = localStorage.getItem(STORAGE_KEYS.theme);
  if (v === 'focus' || v === 'relaxed') return v;
  return 'relaxed';
}

export function setTheme(theme: ThemeId): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    document.documentElement.dataset.theme = theme;
  }
}

/** 答对/答错音效开关，默认关闭 */
export function getSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(STORAGE_KEYS.sound);
  return v === '1';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.sound, enabled ? '1' : '0');
  }
}

/** 用户昵称，未设置时返回空字符串 */
export function getNickname(): string {
  if (typeof window === 'undefined') return '';
  return (localStorage.getItem(STORAGE_KEYS.nickname) ?? '').trim();
}

export function setNickname(name: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.nickname, (name ?? '').trim().slice(0, 20));
  }
}

/** 是否显示小助手文案（空闲小话、答对/答错/解析里的小助手一句）。默认 true */
export function getMascotPhrasesEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(STORAGE_KEYS.mascotPhrases);
  if (v === null) return true;
  return v === '1';
}

export function setMascotPhrasesEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.mascotPhrases, enabled ? '1' : '0');
  }
}

export type MockHistoryEntry = {
  id: string;
  date: string; // ISO
  correctCount: number;
  total: number;
  timeSpentSeconds: number;
};

function getMockHistoryRaw(): MockHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mockHistory);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getMockHistory(): MockHistoryEntry[] {
  return getMockHistoryRaw();
}

export function addMockHistory(entry: Omit<MockHistoryEntry, 'id'>): MockHistoryEntry {
  const list = getMockHistoryRaw();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const newEntry: MockHistoryEntry = { ...entry, id };
  list.unshift(newEntry);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.mockHistory, JSON.stringify(list));
  }
  return newEntry;
}

export function removeMockHistoryEntry(id: string): void {
  const list = getMockHistoryRaw().filter((e) => e.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.mockHistory, JSON.stringify(list));
  }
}

export function clearMockHistory(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.mockHistory);
  }
}

export type PracticeState = {
  order?: { index: number; total: number };
  orderMultiple?: { index: number; total: number };
  topic?: Record<string, { index: number; total: number }>;
};

function getPracticeStateRaw(): PracticeState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.practiceState);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setPracticeStateRaw(state: PracticeState) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.practiceState, JSON.stringify(state));
  }
}

export function getPracticeState(): PracticeState {
  return getPracticeStateRaw();
}

export function setPracticeStateOrder(index: number, total: number) {
  const state = getPracticeStateRaw();
  state.order = { index, total };
  setPracticeStateRaw(state);
}

export function setPracticeStateTopic(tag: string, index: number, total: number) {
  const state = getPracticeStateRaw();
  if (!state.topic) state.topic = {};
  state.topic[tag] = { index, total };
  setPracticeStateRaw(state);
}

export function setPracticeStateOrderMultiple(index: number, total: number) {
  const state = getPracticeStateRaw();
  state.orderMultiple = { index, total };
  setPracticeStateRaw(state);
}

export function clearPracticeStateOrder() {
  const state = getPracticeStateRaw();
  delete state.order;
  setPracticeStateRaw(state);
}

export function clearPracticeStateOrderMultiple() {
  const state = getPracticeStateRaw();
  delete state.orderMultiple;
  setPracticeStateRaw(state);
}

export function clearPracticeStateTopic(tag: string) {
  const state = getPracticeStateRaw();
  if (state.topic) {
    delete state.topic[tag];
    setPracticeStateRaw(state);
  }
}

export function getProgress(): Record<number, { answered: string; correct: boolean }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.progress);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setProgress(id: number, answered: string, correct: boolean) {
  const p = getProgress();
  p[id] = { answered, correct };
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(p));
    incrementTodayPracticeCount();
  }
}

const TODAY_KEY = STORAGE_KEYS.todayPractice;
export function getTodayPracticeCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    return date === new Date().toDateString() ? count : 0;
  } catch {
    return 0;
  }
}

function incrementTodayPracticeCount(): void {
  if (typeof window === 'undefined') return;
  const today = new Date().toDateString();
  try {
    const raw = localStorage.getItem(TODAY_KEY);
    const prev = raw ? JSON.parse(raw) : { date: '', count: 0 };
    const count = prev.date === today ? prev.count + 1 : 1;
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: today, count }));
  } catch {
    localStorage.setItem(TODAY_KEY, JSON.stringify({ date: today, count: 1 }));
  }
}

export function getMilestonesShown(): Record<number, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.milestones);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setMilestoneShown(n: number): void {
  if (typeof window === 'undefined') return;
  const m = getMilestonesShown();
  m[n] = true;
  localStorage.setItem(STORAGE_KEYS.milestones, JSON.stringify(m));
}

export function getWrongIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.wrong);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addWrongId(id: number) {
  const ids = [...new Set([...getWrongIds(), id])];
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEYS.wrong, JSON.stringify(ids));
}

export function removeWrongId(id: number) {
  const ids = getWrongIds().filter((x) => x !== id);
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEYS.wrong, JSON.stringify(ids));
}

export function getFavoriteIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.favorite);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(id: number): boolean {
  const ids = getFavoriteIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((x) => x !== id) : [...ids, id];
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEYS.favorite, JSON.stringify(next));
  return !has;
}

export function getExamDateTarget(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEYS.examDate) ?? '';
}

export function setExamDateTarget(date: string) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEYS.examDate, date);
}

export function getFavoriteTerms(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.favoriteTerms);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteTerm(termKey: string): boolean {
  const ids = getFavoriteTerms();
  const has = ids.includes(termKey);
  const next = has ? ids.filter((x) => x !== termKey) : [...ids, termKey];
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEYS.favoriteTerms, JSON.stringify(next));
  return !has;
}

/** 清除全部本地数据（做题进度、错题、收藏、考试日期、收藏术语、练习位置） */
export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  document.documentElement.dataset.theme = 'relaxed';
}
