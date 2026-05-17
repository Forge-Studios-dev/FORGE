import { Icon } from './Icon';

export type StatusPageAction = { label: string; href: string };

export function StatusPage({
  icon,
  title,
  description,
  action,
  secondary,
}: {
  icon: string;
  title: string;
  description: string;
  action?: StatusPageAction;
  secondary?: StatusPageAction;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-[10%] -top-[20%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
      </div>
      <div className="glass-panel relative z-10 max-w-md rounded-2xl p-10">
        <Icon name={icon} className="mb-6 text-5xl text-primary" />
        <h1 className="font-display-forge mb-3 text-2xl font-bold">{title}</h1>
        <p className="mb-8 text-on-surface-variant">{description}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {action && (
            <a
              href={action.href}
              className="primary-button rounded-full px-8 py-3 font-semibold text-on-primary"
            >
              {action.label}
            </a>
          )}
          {secondary && (
            <a
              href={secondary.href}
              className="rounded-full border border-outline-variant px-8 py-3 hover:border-primary"
            >
              {secondary.label}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
