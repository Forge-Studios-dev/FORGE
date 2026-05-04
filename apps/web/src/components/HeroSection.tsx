import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-surface-secondary to-surface-primary border-b border-white/5">
      <div className="absolute inset-0 bg-gradient-to-br from-forge-900/30 via-transparent to-purple-900/20" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-forge-500/10 border border-forge-500/20 rounded-full px-4 py-1.5 text-forge-400 text-sm font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-forge-400 animate-pulse" />
          Live sessions happening now
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
          Learn skills from
          <span className="text-gradient block">expert creators</span>
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Discover tutorials, live sessions, and learning journeys across crafts, tech, art, music and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-forge-600 hover:bg-forge-500 text-white font-semibold px-8 py-3.5 rounded-xl transition"
          >
            Start Learning
          </Link>
          <Link
            href="#discover"
            className="inline-flex items-center justify-center gap-2 glass hover:bg-white/10 text-white font-semibold px-8 py-3.5 rounded-xl transition"
          >
            Browse Content
          </Link>
        </div>
      </div>
    </section>
  );
}
