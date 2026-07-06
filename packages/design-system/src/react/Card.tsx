import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

/** Generic surface container — the base every other card composes on. */
export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`glass-panel rounded-xl p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

type Trend = { value: number; label?: string };

function TrendPill({ trend }: { trend: Trend }) {
  const positive = trend.value > 0;
  const flat = trend.value === 0;
  const tone = flat ? 'text-on-surface-variant bg-surface-container-high' : positive ? 'text-success bg-success/15' : 'text-critical bg-critical/15';
  const icon = flat ? 'trending_flat' : positive ? 'trending_up' : 'trending_down';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon name={icon} className="text-sm" />
      {positive && !flat ? '+' : ''}
      {trend.value}%{trend.label ? ` ${trend.label}` : ''}
    </span>
  );
}

/** KPI tile — a number, a label, and an optional trend delta vs. a prior period. */
export function StatCard({
  label,
  value,
  icon,
  trend,
  hint,
  className = '',
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  trend?: Trend;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="font-label-caps text-on-surface-variant">{label}</span>
        {icon ? <Icon name={icon} className="text-lg text-outline" /> : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-display-forge text-3xl font-bold tabular-nums leading-none">{value}</span>
        {trend ? <TrendPill trend={trend} /> : null}
      </div>
      {hint ? <span className="text-xs text-secondary">{hint}</span> : null}
    </Card>
  );
}

/** Person/creator summary tile — avatar, name, meta line, optional trailing action. */
export function ProfileCard({
  avatarUrl,
  name,
  meta,
  action,
  className = '',
}: {
  avatarUrl?: string;
  name: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex items-center gap-3 ${className}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
          <Icon name="person" className="text-lg text-outline" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{name}</p>
        {meta ? <p className="truncate text-xs text-on-surface-variant">{meta}</p> : null}
      </div>
      {action}
    </Card>
  );
}
