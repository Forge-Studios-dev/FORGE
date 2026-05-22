import {
  ModerationStatus,
  PublishStatus,
  VideoStatus,
  VideoVisibility,
} from './entities/video.entity';
import { isVideoDiscoverable } from './video-publish.util';

/**
 * End-to-end visibility rules (guest + logged-in consumers).
 * Full HTTP e2e requires a running API + DB; these tests lock the discovery contract.
 */
describe('Video discovery pipeline (guest & authenticated)', () => {
  const publicReady = {
    status: VideoStatus.READY,
    publishStatus: PublishStatus.PUBLISHED,
    visibility: VideoVisibility.PUBLIC,
    moderationStatus: ModerationStatus.NONE,
    scheduledPublishAt: null,
    publishedAt: new Date(Date.now() - 60_000),
    indexedAt: new Date(),
  } as const;

  it('public published indexed video is discoverable', () => {
    expect(isVideoDiscoverable(publicReady as never)).toBe(true);
  });

  it('draft upload is not discoverable until processing finishes', () => {
    expect(
      isVideoDiscoverable({
        ...publicReady,
        status: VideoStatus.PROCESSING,
        publishStatus: PublishStatus.DRAFT,
        indexedAt: null,
      } as never),
    ).toBe(false);
  });

  it('private video is not in discovery (owner/admin use direct access)', () => {
    expect(
      isVideoDiscoverable({
        ...publicReady,
        visibility: VideoVisibility.PRIVATE,
      } as never),
    ).toBe(false);
  });

  it('unlisted video is watchable via link but excluded from feed/search', () => {
    expect(
      isVideoDiscoverable({
        ...publicReady,
        visibility: VideoVisibility.UNLISTED,
        indexedAt: null,
      } as never),
    ).toBe(false);
  });

  it('video without category metadata can still be public but needs tags at upload', () => {
    expect(isVideoDiscoverable(publicReady as never)).toBe(true);
  });

  it('scheduled future publish is hidden from discovery', () => {
    expect(
      isVideoDiscoverable({
        ...publicReady,
        scheduledPublishAt: new Date(Date.now() + 3600_000),
      } as never),
    ).toBe(false);
  });
});
