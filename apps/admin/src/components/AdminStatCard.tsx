import Link from 'next/link';
import { Icon } from '@forge/design-system';

export function AdminStatCard({
  label,
  value,
  icon,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  icon: string;
  href?: string;
  hint?: string;
}) {
  const content = (
    <div className="forge-card-hover glass-panel block rounded-xl p-5 transition hover:border-primary/40">
      <Icon name={icon} className="mb-2 text-primary" />
      <p className="font-display-forge text-2xl font-bold">{value}</p>
      <p className="text-sm text-on-surface-variant">{label}</p>
      {hint ? <p className="mt-1 text-xs text-secondary">{hint}</p> : null}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
