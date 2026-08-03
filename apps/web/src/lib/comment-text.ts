/**
 * Split comment body into plain text and @username mention segments.
 * Mentions are best-effort links to /{username}; existence is not verified.
 */

const MENTION_RE = /@([a-zA-Z0-9_]{2,32})\b/g;

export type CommentTextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; username: string };

export function splitCommentMentions(text: string): CommentTextSegment[] {
  if (!text) return [];
  const segments: CommentTextSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_RE.source, MENTION_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: 'mention',
      value: match[0],
      username: match[1],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}
