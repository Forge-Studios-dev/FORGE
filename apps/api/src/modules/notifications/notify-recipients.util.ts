import { Follow, FollowNotifyLevel } from '../engagement/entities/follow.entity';

/**
 * Split followers by notify bell preference.
 * - all → always include
 * - none → never
 * - personalized → only if in `engagedFollowerIds` (recent watch of this channel)
 */
export function recipientIdsForNotifyLevel(
  followers: Array<Pick<Follow, 'followerId' | 'notifyLevel'>>,
  engagedFollowerIds: Set<string>,
): string[] {
  const ids: string[] = [];
  for (const f of followers) {
    const level = f.notifyLevel ?? FollowNotifyLevel.ALL;
    if (level === FollowNotifyLevel.NONE) continue;
    if (level === FollowNotifyLevel.ALL) {
      ids.push(f.followerId);
      continue;
    }
    // personalized
    if (engagedFollowerIds.has(f.followerId)) {
      ids.push(f.followerId);
    }
  }
  return ids;
}
