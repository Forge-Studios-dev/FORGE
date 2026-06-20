'use client';

import { isImageMediaUrl, isVideoEmbedUrl, toVideoEmbedSrc } from '@/lib/community-media';

type Props = {
  urls: string[];
};

export function CommunityPostMedia({ urls }: Props) {
  if (!urls.length) return null;

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {urls.map((url) => {
        if (isVideoEmbedUrl(url)) {
          const embedSrc = toVideoEmbedSrc(url);
          if (!embedSrc) {
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
              >
                Watch video
              </a>
            );
          }
          return (
            <div
              key={url}
              className="relative overflow-hidden rounded-lg border border-outline-variant/30 pt-[56.25%]"
            >
              <iframe
                src={embedSrc}
                title="Embedded video"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          );
        }

        if (isImageMediaUrl(url)) {
          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-outline-variant/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="max-h-48 w-full object-cover" />
            </a>
          );
        }

        return null;
      })}
    </div>
  );
}
