'use client';

type FunnelStage = {
  stage: string;
  label: string;
  count: number;
  rateFromTop: number;
};

type Props = {
  stages: FunnelStage[];
};

export function CreatorFunnelChart({ stages }: Props) {
  const top = stages[0]?.count ?? 1;

  return (
    <section className="glass-panel space-y-4 rounded-xl p-6">
      <h2 className="font-label-caps text-outline">Member engagement funnel (30d)</h2>
      <div className="space-y-3">
        {stages.map((stage, i) => {
          const widthPct = top > 0 ? Math.max(8, (stage.count / top) * 100) : 8;
          return (
            <div key={stage.stage}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{stage.label}</span>
                <span className="text-on-surface-variant">
                  {stage.count.toLocaleString()} · {stage.rateFromTop}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className={`h-full rounded-full transition-all ${i === 0 ? 'bg-primary' : 'bg-tertiary'}`}
                  style={{ width: `${widthPct}%`, opacity: 1 - i * 0.12 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
