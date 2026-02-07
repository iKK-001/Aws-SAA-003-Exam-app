'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useGlossary } from '@/lib/DataContext';
import { useDrawer } from '@/lib/DrawerContext';
import { getFavoriteTerms, toggleFavoriteTerm } from '@/lib/data';
import { groupTermsByCategory, getCategoryOrder } from '@/lib/glossaryCategories';
import { Search, Star, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { GlossarySkeleton } from '@/components/Skeleton';

export default function GlossaryPage() {
  const { glossary, loading, error } = useGlossary();
  const { openTermDrawer } = useDrawer();
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [favTerms, setFavTerms] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFavTerms(getFavoriteTerms());
  }, []);

  const terms = useMemo(() => {
    if (!glossary) return [];
    const keys = Object.keys(glossary).sort((a, b) => a.localeCompare(b));
    if (!search.trim()) return keys;
    const q = search.trim().toLowerCase();
    return keys.filter((k) => k.toLowerCase().includes(q));
  }, [glossary, search]);

  const byCategory = useMemo(() => groupTermsByCategory(terms), [terms]);
  const categoryOrder = getCategoryOrder();

  const isFavorite = (key: string) => favTerms.includes(key);

  const handleToggleFavorite = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    toggleFavoriteTerm(key);
    setFavTerms(getFavoriteTerms());
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  if (loading) {
    return <GlossarySkeleton />;
  }

  if (error || !glossary) {
    return (
      <div className="flex min-h-safe flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-aws-navy/80">{error || '词库未加载'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link
        href="/glossary/flashcard"
        className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-aws-orange/15 py-3 text-sm font-medium text-aws-orange shadow-soft active:scale-[0.99]"
      >
        <Layers className="h-4 w-4" />
        随机抽一个术语（抽认卡）
      </Link>
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-aws-navy/40" />
        <input
          type="search"
          placeholder="搜索术语"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-aws-blue-light/50 bg-white py-3 pl-11 pr-4 text-aws-navy placeholder:text-aws-navy/40 focus:border-aws-blue-deep focus:outline-none focus:ring-2 focus:ring-aws-blue-deep/20"
        />
      </div>
      <p className="mb-4 text-sm text-aws-navy/60">共 {terms.length} 条 · 按类别展示</p>

      <div className="space-y-4">
        {categoryOrder.map((category) => {
          const list = byCategory[category];
          if (!list?.length) return null;
          const collapsed = collapsedCategories[category] !== false;
          return (
            <section key={category} className="rounded-2xl bg-white/80 shadow-soft">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                aria-expanded={!collapsed}
              >
                <h2 className="text-sm font-semibold text-aws-blue-deep">{category}</h2>
                <span className="flex items-center gap-1 text-xs text-aws-navy/50">
                  共 {list.length} 条
                  {collapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </span>
              </button>
              {!collapsed && (
                <ul className="space-y-2 border-t border-aws-blue-light/30 px-4 pb-4 pt-2">
                  {list.map((key) => {
                    const entry = glossary[key];
                    const expanded = expandedKey === key;
                    return (
                      <li key={key}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedKey(expanded ? null : key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedKey(expanded ? null : key);
                            }
                          }}
                          className="rounded-2xl bg-aws-slate-soft/80 p-4 transition-shadow hover:shadow-soft active:scale-[0.99]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-aws-blue-deep">{key}</span>
                              <p className="mt-1 line-clamp-1 text-sm text-aws-navy/70">
                                {entry?.definition || ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleToggleFavorite(e, key)}
                                className="rounded-xl p-1.5 text-aws-navy/40 hover:bg-aws-blue-light/40 hover:text-aws-navy"
                                aria-label={isFavorite(key) ? '取消收藏' : '收藏'}
                              >
                                <Star
                                  className={`h-5 w-5 ${isFavorite(key) ? 'fill-amber-400 text-amber-500' : ''}`}
                                />
                              </button>
                              {expanded ? (
                                <ChevronUp className="h-5 w-5 text-aws-navy/40" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-aws-navy/40" />
                              )}
                            </div>
                          </div>
                          {expanded && entry && (
                            <div className="mt-4 border-t border-aws-blue-light/40 pt-3">
                              <p className="mb-2 text-sm text-aws-navy/90">{entry.definition}</p>
                              {entry.analogy ? (
                                <p className="mb-2 rounded-xl bg-aws-blue-light/30 p-2 text-sm text-aws-blue-deep">
                                  💡 {entry.analogy}
                                </p>
                              ) : null}
                              {entry.features?.length ? (
                                <>
                                  <p className="mb-1 text-xs font-medium text-aws-navy/70">考试要点</p>
                                  <ul className="space-y-1">
                                    {entry.features.map((f, i) => (
                                      <li key={i} className="flex gap-2 text-xs text-aws-navy/80">
                                        <span className="text-aws-blue-deep">·</span>
                                        {f}
                                      </li>
                                    ))}
                                  </ul>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
