'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Question, Glossary } from './data';

type DataContextValue = {
  questions: Question[];
  glossary: Glossary | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, gRes] = await Promise.all([
        fetch('/data/questions_v2.json', { cache: 'no-store' }),
        fetch('/data/glossary.json', { cache: 'no-store' }),
      ]);
      if (!qRes.ok) throw new Error('题目数据加载失败');
      if (!gRes.ok) throw new Error('词库加载失败');
      const [q, g] = await Promise.all([qRes.json(), gRes.json()]);
      setQuestions(Array.isArray(q) ? q : []);
      setGlossary(g && typeof g === 'object' ? g : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setQuestions([]);
      setGlossary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value: DataContextValue = {
    questions,
    glossary,
    loading,
    error,
    refetch: load,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useQuestions() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useQuestions must be used within DataProvider');
  return ctx;
}

export function useGlossary() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useGlossary must be used within DataProvider');
  return ctx;
}
