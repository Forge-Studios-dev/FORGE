import Link from 'next/link';
import { LegalLinks } from '@/components/legal/LegalLinks';
import { LEGAL_LAST_UPDATED } from '@/content/legal/constants';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-outline-variant/20 bg-surface-container-low/30 px-5 py-8 md:px-12">
      <div className="mx-auto flex max-w-[var(--spacing-container-max)] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display-forge text-sm font-semibold text-on-surface">FORGE</p>
          <p className="mt-1 text-xs text-outline">Skill-first learning from expert creators.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-on-surface-variant" aria-label="Legal and support">
          <LegalLinks linkClassName="hover:text-primary" />
          <span className="hidden text-outline md:inline">|</span>
          <Link href="/live" className="hover:text-primary">
            Live
          </Link>
          <Link href="/explore" className="hover:text-primary">
            Explore
          </Link>
        </nav>
      </div>
      <p className="mx-auto mt-6 max-w-[var(--spacing-container-max)] text-xs text-outline">
        © {new Date().getFullYear()} Forge Studios. Legal documents last updated {LEGAL_LAST_UPDATED}.
      </p>
    </footer>
  );
}
