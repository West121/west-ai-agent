import type { ReactNode } from 'react';

type Datum = {
  label: string;
  value: number;
  tone?: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose';
};

type TrendPoint = {
  label: string;
  value: number;
};

const toneClassMap: Record<NonNullable<Datum['tone']>, { fill: string; bg: string; text: string }> = {
  sky: { fill: '#0ea5e9', bg: 'bg-sky-100', text: 'text-sky-700' },
  emerald: { fill: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  violet: { fill: '#8b5cf6', bg: 'bg-violet-100', text: 'text-violet-700' },
  amber: { fill: '#f59e0b', bg: 'bg-amber-100', text: 'text-amber-700' },
  rose: { fill: '#f43f5e', bg: 'bg-rose-100', text: 'text-rose-700' },
};

function toneStyles(tone: Datum['tone']) {
  return toneClassMap[tone ?? 'sky'];
}

export function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
      {label}
    </div>
  );
}

export function SparklineTrend({
  title,
  subtitle,
  points,
  tone = 'sky',
  actions,
}: {
  title: string;
  subtitle: string;
  points: TrendPoint[];
  tone?: Datum['tone'];
  actions?: ReactNode;
}) {
  if (points.length === 0) {
    return <EmptyChartState label={`${title} 暂无数据`} />;
  }

  const max = Math.max(...points.map((point) => point.value), 1);
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 100;
  const coords = points.map((point, index) => {
    const x = index * stepX;
    const y = 100 - (point.value / max) * 100;
    return `${x},${y}`;
  });
  const toneStyle = toneStyles(tone);

  return (
    <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneStyle.bg} ${toneStyle.text}`}>
          trend
        </span>
      </div>

      <div className="mt-5">
        <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible">
          <polyline
            fill="none"
            stroke={toneStyle.fill}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={coords.join(' ')}
          />
          {points.map((point, index) => {
            const x = index * stepX;
            const y = 100 - (point.value / max) * 100;
            return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3.4" fill={toneStyle.fill} />;
          })}
        </svg>
      </div>

      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-4">
        {points.map((point) => (
          <div key={point.label} className="rounded-2xl bg-slate-50 px-3 py-2">
            <p>{point.label}</p>
            <p className="mt-1 font-semibold text-slate-900">{point.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StackedBars({
  title,
  subtitle,
  items,
  actions,
}: {
  title: string;
  subtitle: string;
  items: Datum[];
  actions?: ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyChartState label={`${title} 暂无数据`} />;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full w-full">
          {items.map((item) => {
            const toneStyle = toneStyles(item.tone);
            return (
              <div
                key={item.label}
                title={`${item.label}: ${item.value}`}
                className="h-full"
                style={{
                  width: `${Math.max(6, (item.value / total) * 100)}%`,
                  backgroundColor: toneStyle.fill,
                }}
              />
            );
          })}
        </div>
      </div>

      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const toneStyle = toneStyles(item.tone);
          const ratio = Math.round((item.value / total) * 100);
          return (
            <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: toneStyle.fill }} />
                <span className="text-sm font-medium text-slate-900">{item.label}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{ratio}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function HorizontalBars({
  title,
  subtitle,
  items,
  actions,
}: {
  title: string;
  subtitle: string;
  items: Datum[];
  actions?: ReactNode;
}) {
  if (items.length === 0) {
    return <EmptyChartState label={`${title} 暂无数据`} />;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const toneStyle = toneStyles(item.tone);
          return (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-900">{item.label}</span>
                <span className="text-slate-500">{item.value}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(8, (item.value / max) * 100)}%`,
                    backgroundColor: toneStyle.fill,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
