'use client';

import Link from 'next/link';
import Image from 'next/image';
import { LiveBadge } from '@forge/design-system';
import { User } from '@/types';
import { resolveStreamPoster } from '@/lib/stream-poster';
import { useLiveStreamsQuery } from '@/hooks/useLiveStreamsQuery';

export function LiveNowRail() {
  const { data: allStreams } = useLiveStreamsQuery();
  const streams = allStreams?.slice(0, 6);

  if (!streams?.length) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display-forge text-2xl font-semibold">Live now</h2>
        <Link href="/live" className="font-label-caps text-secondary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {streams.map((s) => {
          const poster = resolveStreamPoster(s);
          return (
            <Link
              key={s.id}
              href={`/live/${s.id}`}
              className="glass-panel group overflow-hidden rounded-xl transition hover:border-primary/30"
            >
              <div className="relative aspect-video bg-surface-container-high">
                {poster ? (
                  <Image
                    src={poster}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
                <span className="absolute left-3 top-3">
                  <LiveBadge />
                </span>
              </div>
              <div className="p-4">
                <p className="line-clamp-2 font-medium group-hover:text-primary">{s.title}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {(s.user as User)?.displayName ?? 'Creator'}
                  {s.viewerCount ? ` · ${s.viewerCount} watching` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
