import type { ComponentType, ReactNode } from 'react';
import { StatusPill, type StatusTone } from './StatusPill';

export type AlertStripItem = {
  id: string;
  label: string;
  detail?: string;
  href: string;
  tone: StatusTone;
  /** Defaults to a title-cased version of `tone` (e.g. "Critical"). */
  toneLabel?: string;
};

type LinkComponent = ComponentType<{ href: string; className?: string; children: ReactNode }>;

const DEFAULT_TONE_LABEL: Record<StatusTone, string> = {
  neutral: 'Info',
  primary: 'New',
  success: 'Good',
  warning: 'Warning',
  critical: 'Critical',
  live: 'Live',
  reward: 'Reward',
};

function DefaultLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/**
 * "Needs your attention" strip — a severity-ranked list of things to act on
 * right now, distinct from KPI stat cards which are read-only. Shared by the
 * admin dashboard's triage queue and Studio home's creator attention strip;
 * both merge several data sources into `items` before rendering.
 */
export function AlertStrip({
  title = 'Needs your attention',
  items,
  emptyMessage = 'Nothing needs attention right now.',
  linkComponent: Link = DefaultLink,
}: {
  title?: string;
  items: AlertStripItem[];
  emptyMessage?: string;
  /** Pass your app's router Link (e.g. next/link) for client-side navigation; defaults to a plain `<a>`. */
  linkComponent?: LinkComponent;
}) {
  return (
    <section className="glass-panel rounded-xl p-6">
      <h2 className="font-display-forge mb-4 text-lg font-semibold">{title}</h2>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 rounded-lg px-2 py-2.5 hover:bg-surface-container-high/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  {item.detail ? (
                    <p className="truncate text-xs text-on-surface-variant">{item.detail}</p>
                  ) : null}
                </div>
                <StatusPill
                  tone={item.tone}
                  label={item.toneLabel ?? DEFAULT_TONE_LABEL[item.tone]}
                  className="shrink-0"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-on-surface-variant">{emptyMessage}</p>
      )}
    </section>
  );
}
