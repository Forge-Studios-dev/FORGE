'use client';

type TrendPoint = { date: string; count: number };

type Props = {
  title: string;
  data: TrendPoint[];
  colorClass?: string;
};

export function CommunityTrendsChart({ title, data, colorClass = 'bg-primary' }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <section className="glass-panel rounded-xl p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No activity in this period.</p>
      ) : (
        <div className="flex items-end gap-2" style={{ minHeight: 120 }}>
          {data.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-on-surface-variant">{point.count}</span>
              <div
                className={`w-full rounded-t-md ${colorClass} transition-all`}
                style={{ height: `${Math.max(8, (point.count / max) * 96)}px` }}
                title={`${point.date}: ${point.count}`}
              />
              <span className="text-[9px] text-outline">{point.date.slice(5)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
