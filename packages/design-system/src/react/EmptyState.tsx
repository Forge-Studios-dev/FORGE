import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

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
  let cta: ReactNode = null;
  if (onAction) {
    cta = (
      <Button type="button" onClick={onAction} className="mt-6">
        {action?.label ?? 'Retry'}
      </Button>
    );
  } else if (action) {
    cta = (
      <a href={action.href} className="primary-button mt-6 inline-block rounded-full px-6 py-2 text-sm font-semibold text-on-primary">
        {action.label}
      </a>
    );
  }

  return (
    <section className="glass-panel flex flex-col items-center rounded-xl px-6 py-12 text-center">
      <Icon name={icon} className="mb-4 text-4xl text-outline" />
      <h3 className="font-display-forge text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-on-surface-variant">{description}</p> : null}
      {cta}
    </section>
  );
}
