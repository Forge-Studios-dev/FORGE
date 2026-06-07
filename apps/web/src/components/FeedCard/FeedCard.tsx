import Image from 'next/image';
import Link from 'next/link';
import { SkillChip } from '@forge/design-system';
import { Video } from '@/types';
import { formatCount, formatDuration, timeAgo } from '@/lib/utils';

export type FeedCardLayout = 'grid' | 'carousel' | 'sidebar';

interface Props {
  video: Video;
  layout?: FeedCardLayout;
  /** @deprecated use layout="carousel" */
  compact?: boolean;
}

const LAYOUT_CLASS: Record<FeedCardLayout, string> = {
  grid: 'w-full min-w-0',
  carousel: 'w-[280px] shrink-0 flex-none sm:w-[300px] md:w-[320px]',
  sidebar: 'w-full min-w-0 max-w-full',
};

function resolveLayout(compact?: boolean, layout?: FeedCardLayout): FeedCardLayout {
  if (layout) return layout;
  if (compact) return 'carousel';
  return 'grid';
}

function primarySkill(video: Video): string {
  return video.skillTags?.[0]?.name ?? 'Skill';
}

function imageSizes(layout: FeedCardLayout): string {
  if (layout === 'carousel') return '(max-width: 640px) 280px, (max-width: 768px) 300px, 320px';
  if (layout === 'sidebar') return '(max-width: 1024px) 100vw, 360px';
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw';
}

export function FeedCard({ video, compact, layout: layoutProp }: Props) {
  const layout = resolveLayout(compact, layoutProp);
  const compactMeta = layout === 'carousel' || layout === 'sidebar';
  const creatorName = video.user?.displayName ?? 'Creator';
  const creatorInitial = creatorName[0] ?? '?';

  return (
    <Link
      href={`/watch/${video.id}`}
      className={`forge-card-hover group block cursor-pointer ${LAYOUT_CLASS[layout]}`}
    >
      <div className="border-subtle relative aspect-video w-full overflow-hidden rounded-xl border bg-surface-container-highest transition-colors group-hover:border-primary/50">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
            sizes={imageSizes(layout)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-container-high text-2xl">
            🎬
          </div>
        )}
        <SkillChip skill={primarySkill(video)} />
        <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-on-primary shadow-lg">
            ▶
          </span>
        </div>
        {video.durationSeconds ? (
          <span className="font-label-caps absolute bottom-3 right-3 rounded bg-background/80 px-2 py-0.5 text-[10px] text-on-surface">
            {formatDuration(video.durationSeconds)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        <h3 className="font-display-forge line-clamp-2 text-sm font-semibold text-on-surface group-hover:text-primary">
          {video.title}
        </h3>
        {!compactMeta && (
          <>
            <div className="mt-2 flex items-center gap-2">
              {video.user?.avatarUrl ? (
                <Image
                  src={video.user.avatarUrl}
                  alt={creatorName}
                  width={20}
                  height={20}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary">
                  {creatorInitial}
                </div>
              )}
              <span className="truncate text-xs text-on-surface-variant">{creatorName}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-outline">
              <span>{formatCount(video.viewCount)} views</span>
              <span>·</span>
              <span>{timeAgo(video.createdAt)}</span>
            </div>
          </>
        )}
        {compactMeta && (
          <p className="mt-1 truncate text-sm text-on-surface-variant">
            {creatorName}
            {video.viewCount ? ` · ${formatCount(video.viewCount)} views` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
