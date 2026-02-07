'use client';

import { useMemo } from 'react';

type Segment = { type: 'text'; value: string } | { type: 'term'; value: string };

/** 将正文中出现的术语切成片段，术语按长度降序避免短词先匹配 */
function segmentByTerms(text: string, terms: string[]): Segment[] {
  if (!text || !terms?.length) return [{ type: 'text', value: text }];
  const sorted = [...terms].filter(Boolean).sort((a, b) => b.length - a.length);
  const result: Segment[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let found: { term: string; index: number } | null = null;
    for (const term of sorted) {
      const idx = remaining.indexOf(term);
      if (idx !== -1 && (found === null || idx < found.index)) {
        found = { term, index: idx };
      }
    }
    if (found === null) {
      result.push({ type: 'text', value: remaining });
      break;
    }
    if (found.index > 0) {
      result.push({ type: 'text', value: remaining.slice(0, found.index) });
    }
    result.push({ type: 'term', value: found.term });
    remaining = remaining.slice(found.index + found.term.length);
  }
  return result;
}

type Props = {
  text: string;
  terms: string[];
  onTermClick: (term: string) => void;
  className?: string;
};

export function HighlightTerms({ text, terms, onTermClick, className = '' }: Props) {
  const segments = useMemo(() => segmentByTerms(text, terms), [text, terms]);
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          seg.value
        ) : (
          <button
            key={`${i}-${seg.value}`}
            type="button"
            onClick={() => onTermClick(seg.value)}
            className="rounded bg-aws-orange/20 px-0.5 font-medium text-aws-orange underline decoration-aws-orange/50 underline-offset-1 hover:bg-aws-orange/30"
          >
            {seg.value}
          </button>
        )
      )}
    </span>
  );
}
