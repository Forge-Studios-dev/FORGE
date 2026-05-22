import {
  ModerationStatus,
  PublishStatus,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';
import {
  indexedAtOnReady,
  isVideoDiscoverable,
  shouldIndexVideo,
} from './video-publish.util';

describe('isVideoDiscoverable', () => {
  const base = {
    status: VideoStatus.READY,
    publishStatus: PublishStatus.PUBLISHED,
    visibility: VideoVisibility.PUBLIC,
    moderationStatus: ModerationStatus.NONE,
    scheduledPublishAt: null,
    publishedAt: new Date(Date.now() - 60_000),
    indexedAt: new Date(),
  } as const;

  it('returns true for public published ready videos', () => {
    expect(isVideoDiscoverable(base as never)).toBe(true);
  });

  it('returns false for draft publish status', () => {
    expect(
      isVideoDiscoverable({
        ...base,
        publishStatus: PublishStatus.DRAFT,
        indexedAt: null,
      } as never),
    ).toBe(false);
  });

  it('returns false without indexedAt', () => {
    expect(isVideoDiscoverable({ ...base, indexedAt: null } as never)).toBe(false);
  });

  it('returns false for private visibility', () => {
    expect(
      isVideoDiscoverable({ ...base, visibility: VideoVisibility.PRIVATE } as never),
    ).toBe(false);
  });

  it('returns false for unlisted visibility', () => {
    expect(
      isVideoDiscoverable({ ...base, visibility: VideoVisibility.UNLISTED } as never),
    ).toBe(false);
  });

  it('returns false for future scheduled publish', () => {
    expect(
      isVideoDiscoverable({
        ...base,
        scheduledPublishAt: new Date(Date.now() + 3600_000),
      } as never),
    ).toBe(false);
  });
});

describe('shouldIndexVideo', () => {
  const base = {
    status: VideoStatus.READY,
    publishStatus: PublishStatus.PUBLISHED,
    visibility: VideoVisibility.PUBLIC,
    moderationStatus: ModerationStatus.NONE,
    scheduledPublishAt: null,
    publishedAt: new Date(Date.now() - 60_000),
    indexedAt: null,
  } as const;

  it('returns true for public published ready videos without indexedAt', () => {
    expect(shouldIndexVideo(base as never)).toBe(true);
  });

  it('returns false for private visibility', () => {
    expect(
      shouldIndexVideo({ ...base, visibility: VideoVisibility.PRIVATE } as never),
    ).toBe(false);
  });
});

describe('indexedAtOnReady', () => {
  const now = new Date('2026-05-22T12:00:00Z');

  it('sets indexedAt when video becomes discoverable after processing', () => {
    const result = indexedAtOnReady(
      {
        status: VideoStatus.PROCESSING,
        publishStatus: PublishStatus.DRAFT,
        visibility: VideoVisibility.PUBLIC,
        moderationStatus: ModerationStatus.NONE,
        scheduledPublishAt: null,
        publishedAt: now,
        indexedAt: null,
      } as never,
      now,
    );
    expect(result).toEqual(now);
  });

  it('returns null for private videos', () => {
    expect(
      indexedAtOnReady(
        {
          status: VideoStatus.READY,
          publishStatus: PublishStatus.PUBLISHED,
          visibility: VideoVisibility.PRIVATE,
          moderationStatus: ModerationStatus.NONE,
          scheduledPublishAt: null,
          publishedAt: now,
          indexedAt: null,
        } as never,
        now,
      ),
    ).toBeNull();
  });
});
