import { Video, VideoStatus, VideoVisibility, ModerationStatus } from './entities/video.entity';
import { jsonSafeIntField, toAdminVideo } from './video.mapper';

describe('video.mapper', () => {
  describe('jsonSafeIntField', () => {
    it('converts bigint to number', () => {
      expect(jsonSafeIntField(BigInt(9_007_199_254_740_991n))).toBe(9_007_199_254_740_991);
    });

    it('returns null for nullish values', () => {
      expect(jsonSafeIntField(null)).toBeNull();
      expect(jsonSafeIntField(undefined)).toBeNull();
    });
  });

  describe('toAdminVideo', () => {
    it('produces JSON-serializable output when entity has bigint file sizes', () => {
      const video = {
        id: 'v1',
        userId: 'u1',
        user: { id: 'u1', displayName: 'Creator', username: 'creator' },
        title: 'Test',
        description: null,
        status: VideoStatus.READY,
        visibility: VideoVisibility.PUBLIC,
        moderationStatus: ModerationStatus.NONE,
        moderationNote: null,
        moderatedAt: null,
        moderatedBy: null,
        viewCount: 1,
        likeCount: 0,
        commentCount: 0,
        uploadFileSizeBytes: BigInt(1_500_000_000),
        fileSizeBytes: BigInt(1_500_000_000),
        hlsUrl: null,
        thumbnailUrl: null,
        scheduledPublishAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      } as unknown as Video;

      const admin = toAdminVideo(video);
      expect(() => JSON.stringify(admin)).not.toThrow();
      expect(admin.uploadFileSizeBytes).toBe(1_500_000_000);
      expect(admin.fileSizeBytes).toBe(1_500_000_000);
      expect(admin.user?.username).toBe('creator');
    });
  });
});
