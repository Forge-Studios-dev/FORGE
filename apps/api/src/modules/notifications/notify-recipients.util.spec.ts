import { recipientIdsForNotifyLevel } from './notify-recipients.util';
import { FollowNotifyLevel } from '../engagement/entities/follow.entity';

describe('recipientIdsForNotifyLevel', () => {
  it('includes all, skips none, gates personalized on engagement', () => {
    const followers = [
      { followerId: 'a', notifyLevel: FollowNotifyLevel.ALL },
      { followerId: 'b', notifyLevel: FollowNotifyLevel.NONE },
      { followerId: 'c', notifyLevel: FollowNotifyLevel.PERSONALIZED },
      { followerId: 'd', notifyLevel: FollowNotifyLevel.PERSONALIZED },
    ];
    const engaged = new Set(['c']);
    expect(recipientIdsForNotifyLevel(followers, engaged).sort()).toEqual(['a', 'c']);
  });

  it('treats missing level as all', () => {
    const followers = [{ followerId: 'x', notifyLevel: undefined as unknown as FollowNotifyLevel }];
    expect(recipientIdsForNotifyLevel(followers, new Set())).toEqual(['x']);
  });
});
