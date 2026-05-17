export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <h1 className="font-display-forge text-2xl font-bold md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-on-surface-variant">{subtitle}</p>}
    </header>
  );
}
