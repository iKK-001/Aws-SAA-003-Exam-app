'use client';

import { useId } from 'react';

/** 轻量折线图：data 为 { label, value }，value 为 0–100 正确率 */
export default function LineChart({
  data,
  height = 180,
  valueLabel = '%',
  className = '',
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueLabel?: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, '-');

  if (data.length === 0) return null;

  const padding = { top: 12, right: 8, bottom: 28, left: 36 };
  const w = 320;
  const h = height;
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const minY = 0;
  const maxY = Math.max(100, ...values);
  const rangeY = maxY - minY || 1;

  const points = data.map((d, i) => {
    const x =
      padding.left +
      (data.length === 1 ? chartW / 2 : (i / Math.max(1, data.length - 1)) * chartW);
    const y = padding.top + chartH - ((d.value - minY) / rangeY) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const yTicks = [0, 50, 100].filter((t) => t <= maxY);
  const xStep = data.length > 6 ? Math.ceil(data.length / 5) : 1;

  return (
    <div className={className}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path
          d={pathD}
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="rgb(16, 185, 129)" className="text-emerald-500" />
        ))}
        {/* Y 轴刻度 */}
        {yTicks.map((tick) => {
          const y = padding.top + chartH - ((tick - minY) / rangeY) * chartH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartW}
                y2={y}
                stroke="rgb(203, 213, 225)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <text
                x={padding.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-aws-navy/50 text-[10px]"
              >
                {tick}{valueLabel}
              </text>
            </g>
          );
        })}
        {/* X 轴标签（间隔显示避免拥挤） */}
        {points.map((p, i) => {
          if (i % xStep !== 0 && i !== points.length - 1) return null;
          const short =
            p.label.length > 10
              ? p.label.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2-$3')
              : p.label.replace(/^第 (\d+)-(\d+) 题$/, '$1-$2');
          return (
            <text
              key={i}
              x={p.x}
              y={h - 6}
              textAnchor="middle"
              className="fill-aws-navy/50 text-[10px]"
            >
              {short}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
