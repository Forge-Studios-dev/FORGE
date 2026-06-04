import Link from 'next/link';
import type { LegalSection } from '@/content/legal/constants';
import {
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_PLATFORM_NAME,
  LEGAL_PRIVACY_EMAIL,
} from '@/content/legal/constants';

type Props = {
  title: string;
  intro: string;
  sections: LegalSection[];
  alternateHref: { href: string; label: string };
};

export function LegalDocument({ title, intro, sections, alternateHref }: Props) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-10 md:px-12 md:py-14">
      <header className="mb-10 border-b border-outline-variant/30 pb-8">
        <p className="font-label-caps mb-2 text-outline">Legal</p>
        <h1 className="font-display-forge mb-3 text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="text-sm text-on-surface-variant">
          {LEGAL_PLATFORM_NAME} · {LEGAL_COMPANY_NAME} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        <p className="mt-4 text-on-surface-variant">{intro}</p>
        <p className="mt-4 text-sm">
          See also{' '}
          <Link href={alternateHref.href} className="text-primary hover:underline">
            {alternateHref.label}
          </Link>
        </p>
      </header>

      <nav className="glass-panel mb-10 rounded-xl p-5 text-sm" aria-label="Table of contents">
        <p className="font-label-caps mb-3 text-outline">On this page</p>
        <ol className="space-y-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="prose-legal space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-display-forge mb-4 text-xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="mb-3 text-sm leading-relaxed text-on-surface-variant">
                {p}
              </p>
            ))}
            {section.bullets?.length ? (
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-on-surface-variant">
                {section.bullets.map((b) => (
                  <li key={b.slice(0, 40)}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-outline-variant/30 pt-8 text-sm text-on-surface-variant">
        <p>
          Questions?{' '}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-primary hover:underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          {' · '}
          <a href={`mailto:${LEGAL_PRIVACY_EMAIL}`} className="text-primary hover:underline">
            {LEGAL_PRIVACY_EMAIL}
          </a>
        </p>
      </footer>
    </article>
  );
}
