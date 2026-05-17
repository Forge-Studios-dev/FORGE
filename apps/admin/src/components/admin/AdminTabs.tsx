'use client';

export type AdminTab = { id: string; label: string };

export function AdminTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: AdminTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-outline-variant/20">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`font-label-caps px-4 py-3 text-xs transition ${
            active === tab.id
              ? 'border-b-2 border-primary text-primary'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

