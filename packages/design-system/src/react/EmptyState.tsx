import { buttonClassName } from './Button';
import { Icon } from './Icon';

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
  const ctaClass = `${buttonClassName('primary')} mt-6`;

  return (
    <section className="glass-panel forge-fade-in flex flex-col items-center rounded-xl px-6 py-12 text-center">
      <Icon name={icon} className="mb-4 text-4xl text-outline" />
      <h3 className="font-display-forge text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-on-surface-variant">{description}</p> : null}
      {onAction ? (
        <button type="button" onClick={onAction} className={ctaClass}>
          {action?.label ?? 'Retry'}
        </button>
      ) : action ? (
        <a href={action.href} className={ctaClass}>
          {action.label}
        </a>
      ) : null}
    </section>
  );
}
