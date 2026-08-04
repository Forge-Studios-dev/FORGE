'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  /** Accessible name for the trigger (and menu when open). */
  label: string;
  /** Trigger control — rendered as-is; click toggles the menu. */
  trigger: ReactNode;
  /** Extra classes on the trigger button wrapper when `trigger` is not already a button. */
  triggerClassName?: string;
  /** Panel width / layout classes. */
  panelClassName?: string;
  align?: 'left' | 'right' | 'center';
  /** Drop below trigger (default) or rise above (mobile bottom nav). */
  placement?: 'bottom' | 'top';
  /** `menu` for action lists; `dialog` for richer panels (e.g. notifications). */
  panelRole?: 'menu' | 'dialog';
  children: (close: () => void) => ReactNode;
};

/**
 * Focus-safe dropdown: Esc closes, Tab cycles inside the panel, outside click
 * dismisses, focus restores to the trigger. Prefer this over `<details>` menus.
 */
export function PopoverMenu({
  label,
  trigger,
  triggerClassName,
  panelClassName = 'w-56',
  align = 'right',
  placement = 'bottom',
  panelRole = 'menu',
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();

    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      } else if (!panel.contains(active)) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) return;
    // Restore only when we just closed while focus was inside the panel.
    const active = document.activeElement;
    if (panelRef.current?.contains(active) || active === document.body) {
      triggerRef.current?.focus();
    }
  }, [open]);

  const padClass =
    panelClassName.includes('p-0') || panelClassName.includes('py-') ? '' : 'py-2';
  const placeClass =
    placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  const alignClass =
    align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup={panelRole === 'dialog' ? 'dialog' : 'menu'}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role={panelRole}
          aria-modal={panelRole === 'dialog' ? true : undefined}
          aria-label={label}
          tabIndex={-1}
          className={`absolute z-50 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high shadow-lg ${placeClass} ${alignClass} ${padClass} ${panelClassName}`}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
