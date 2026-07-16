import { Icon } from './Icon';

/**
 * Canonical tone vocabulary — shared by StatusPill, PaywallCard, and any
 * consumer badge (subscription status, moderation status, fraud risk,
 * notification category). Semantic tones (success/warning/critical) are
 * separate from brand accents (primary/live/reward) so state and brand never
 * compete for the same color.
 */
export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'critical' | 'live' | 'reward';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  critical: 'bg-critical/15 text-critical',
  live: 'bg-live/15 text-live',
  reward: 'bg-tertiary/15 text-tertiary',
};

/** Small status/state badge — subscription status, KPI health, moderation state, notification category. */
export function StatusPill({
  tone = 'neutral',
  label,
  icon,
  className = '',
}: {
  tone?: StatusTone;
  label: string;
  icon?: string;
  className?: string;
}) {
  return (
    <span
      className={`font-label-caps inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon ? <Icon name={icon} className="text-xs" /> : null}
      {label}
    </span>
  );
}
