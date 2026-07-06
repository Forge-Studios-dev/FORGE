'use client';

import { useRef, type ReactNode } from 'react';

export type TabItem = { id: string; label: string; icon?: string };

/**
 * Accessible tab list — roving tabindex, arrow-key navigation, proper aria roles.
 * Renders the tab strip only; pair with your own panel content keyed off `value`.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  className = '',
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length];
    refs.current[tab.id]?.focus();
    onChange(tab.id);
  }

  return (
    <div role="tablist" aria-orientation="horizontal" className={`flex gap-1 border-b border-subtle ${className}`}>
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focusTab(i + 1);
              if (e.key === 'ArrowLeft') focusTab(i - 1);
              if (e.key === 'Home') focusTab(0);
              if (e.key === 'End') focusTab(tabs.length - 1);
            }}
            className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
              selected ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
            {selected ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Panel wrapper — only renders its children while its id matches the active tab. */
export function TabPanel({ id, value, children }: { id: string; value: string; children: ReactNode }) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" tabIndex={0}>
      {children}
    </div>
  );
}
