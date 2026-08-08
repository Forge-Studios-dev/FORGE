/** Metadata keys that identify a peer who triggered the notification. */
const ACTOR_META_KEYS = [
  'creatorId',
  'followerId',
  'likerId',
  'tipperId',
  'authorId',
  'senderId',
  'fromUserId',
  'actorId',
] as const;

/** Returns peer user ids referenced in notification metadata (for block filtering). */
export function actorIdsFromNotificationMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const ids: string[] = [];
  for (const key of ACTOR_META_KEYS) {
    const v = metadata[key];
    if (typeof v === 'string' && v.length > 0) ids.push(v);
  }
  return ids;
}

export function notificationInvolvesBlockedPeer(
  metadata: Record<string, unknown> | null | undefined,
  blockedPeerIds: ReadonlySet<string>,
): boolean {
  if (blockedPeerIds.size === 0) return false;
  return actorIdsFromNotificationMetadata(metadata).some((id) => blockedPeerIds.has(id));
}
