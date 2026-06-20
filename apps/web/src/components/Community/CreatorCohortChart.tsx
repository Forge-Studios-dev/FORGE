'use client';

type CohortPoint = {
  period: string;
  cohortSize: number;
  retained: number;
  engagedRetained: number;
  retentionRate: number;
};

type Props = {
  title: string;
  data: CohortPoint[];
};

export function CreatorCohortChart({ title, data }: Props) {
  return (
    <section className="glass-panel rounded-xl p-6">
      <h2 className="mb-3 font-label-caps text-outline">{title}</h2>
      {data.length === 0 ? (
        <p className="text-xs text-on-surface-variant">Not enough subscription history yet.</p>
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <div key={row.period}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span>{row.period}</span>
                <span className="text-on-surface-variant">
                  {row.retained}/{row.cohortSize} active · {row.retentionRate}%
                  {row.engagedRetained > 0 ? ` · ${row.engagedRetained} engaged` : ''}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${row.retentionRate}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-outline">
            Bar = % of cohort still subscribed · Engaged = active in community (30d)
          </p>
        </div>
      )}
    </section>
  );
}
