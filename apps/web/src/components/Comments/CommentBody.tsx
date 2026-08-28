'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { splitCommentMentions } from '@/lib/comment-text';
import { parseTimestampToSeconds } from '@/lib/description-timestamps';

export function CommentBody({
  content,
  onSeek,
}: {
  content: string;
  onSeek?: (seconds: number) => void;
}) {
  const parts = splitCommentMentions(content);
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <Link
              key={`${i}-${part.username}`}
              href={`/${part.username}`}
              className="font-medium text-primary hover:underline"
            >
              {part.value}
            </Link>
          );
        }
        if (!onSeek) return <span key={i}>{part.value}</span>;
        // Light timestamp linkify inside plain text (mm:ss / h:mm:ss)
        const stampRe =
          /(?:^|[\s([{])((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)(?=$|[\s)\].,!?;:])/g;
        const nodes: ReactNode[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        const text = part.value;
        while ((m = stampRe.exec(text)) !== null) {
          const stamp = m[1];
          const stampIndex = m.index + m[0].indexOf(stamp);
          const seconds = parseTimestampToSeconds(stamp);
          if (seconds === null) continue;
          if (stampIndex > last) nodes.push(text.slice(last, stampIndex));
          nodes.push(
            <button
              key={`${i}-t-${stampIndex}`}
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => onSeek(seconds)}
            >
              {stamp}
            </button>,
          );
          last = stampIndex + stamp.length;
        }
        if (last < text.length) nodes.push(text.slice(last));
        return <span key={i}>{nodes.length ? nodes : text}</span>;
      })}
    </p>
  );
}
