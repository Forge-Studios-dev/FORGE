import Link from 'next/link';
import { Icon } from '@forge/design-system';

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  onAction,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  onAction?: () => void;
}) {
  const ctaClass = 'primary-button mt-6 rounded-full px-6 py-2 text-sm font-semibold text-on-primary';

  return (
    <section className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center forge-fade-in">
      <Icon name={icon} className="mb-4 text-4xl text-outline" />
      <h3 className="font-display-forge text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-on-surface-variant">{description}</p> : null}
      {onAction ? (
        <button type="button" onClick={onAction} className={ctaClass}>
          {action?.label ?? 'Retry'}
        </button>
      ) : action ? (
        <Link href={action.href} className={ctaClass}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}
