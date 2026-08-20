import { GamificationListener } from './gamification.listener';
import { PlatformXpAction } from './gamification.service';

describe('GamificationListener', () => {
  const gamificationService = {
    awardXp: jest.fn().mockResolvedValue(undefined),
    awardPlatformXp: jest.fn().mockResolvedValue(undefined),
  };
  let listener: GamificationListener;
  let prevFlag: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    prevFlag = process.env.FEATURES_SKILL_ECONOMY_LMS;
    process.env.FEATURES_SKILL_ECONOMY_LMS = 'true';
    listener = new GamificationListener(gamificationService as never);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.FEATURES_SKILL_ECONOMY_LMS;
    else process.env.FEATURES_SKILL_ECONOMY_LMS = prevFlag;
  });

  it('awards platform XP when a video finishes processing', async () => {
    await listener.onVideoReady({ userId: 'u1' } as never);
    expect(gamificationService.awardPlatformXp).toHaveBeenCalledWith('u1', PlatformXpAction.VIDEO_UPLOAD);
  });

  it('awards platform XP to the commenter, not the video owner', async () => {
    await listener.onCommentCreated({ comment: { userId: 'commenter-1' } } as never);
    expect(gamificationService.awardPlatformXp).toHaveBeenCalledWith(
      'commenter-1',
      PlatformXpAction.COMMENT_CREATE,
    );
  });

  it('awards platform XP when a viewer joins a live stream', async () => {
    await listener.onStreamViewerJoined({ userId: 'viewer-1' } as never);
    expect(gamificationService.awardPlatformXp).toHaveBeenCalledWith(
      'viewer-1',
      PlatformXpAction.LIVE_ATTEND,
    );
  });

  it('awards platform XP to the creator when a course is published', async () => {
    await listener.onCoursePublished({ creatorId: 'creator-1' } as never);
    expect(gamificationService.awardPlatformXp).toHaveBeenCalledWith(
      'creator-1',
      PlatformXpAction.COURSE_PUBLISH,
    );
  });

  it('awards platform XP to the learner when a lesson is completed', async () => {
    await listener.onLessonCompleted({ userId: 'learner-1' } as never);
    expect(gamificationService.awardPlatformXp).toHaveBeenCalledWith(
      'learner-1',
      PlatformXpAction.LESSON_COMPLETE,
    );
  });

  it('is a no-op when the skill-economy LMS flag is off', async () => {
    process.env.FEATURES_SKILL_ECONOMY_LMS = 'false';
    await listener.onVideoReady({ userId: 'u1' } as never);
    expect(gamificationService.awardPlatformXp).not.toHaveBeenCalled();
  });

  it('does not throw and does not award when userId is missing', async () => {
    await expect(listener.onCommentCreated({ comment: {} } as never)).resolves.toBeUndefined();
    expect(gamificationService.awardPlatformXp).not.toHaveBeenCalled();
  });

  it('swallows an award failure without throwing (event handlers must not crash the emitter)', async () => {
    gamificationService.awardPlatformXp.mockRejectedValueOnce(new Error('db down'));
    await expect(listener.onVideoReady({ userId: 'u1' } as never)).resolves.toBeUndefined();
  });

  describe('community.activity (existing behavior, unchanged)', () => {
    it('awards community XP for a valid payload', async () => {
      await listener.onCommunityActivity({
        userId: 'u1',
        communityId: 'c1',
        xp: 5,
        source: 'community_post',
      });
      expect(gamificationService.awardXp).toHaveBeenCalledWith('u1', 'c1', 5, 'community_post');
    });

    it('ignores a payload missing required fields', async () => {
      await listener.onCommunityActivity({ userId: '', communityId: 'c1', xp: 5, source: 'x' });
      expect(gamificationService.awardXp).not.toHaveBeenCalled();
    });
  });
});
