import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-subtle bg-surface-container-low">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
      <div className="relative px-6 py-16 text-center md:py-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
          Skill-first creator learning
        </div>

        <h1 className="font-display-forge mb-6 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          Learn skills from
          <span className="text-gradient-forge block">expert creators</span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-on-surface-variant">
          Discover tutorials, live sessions, and learning journeys across crafts, tech, art, music and more.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="primary-button inline-flex items-center justify-center rounded-full px-8 py-3.5 font-semibold text-on-primary"
          >
            Start Learning
          </Link>
          <Link
            href="#discover"
            className="inline-flex items-center justify-center rounded-full border border-outline-variant px-8 py-3.5 font-semibold text-on-surface hover:border-primary"
          >
            Browse Content
          </Link>
        </div>
      </div>
    </section>
  );
}
