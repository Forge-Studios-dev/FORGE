import { toPublicStream, serializeStreamForCache } from './stream.mapper';
import {
  Stream,
  StreamChatMode,
  StreamEndReason,
  StreamStatus,
  StreamVisibility,
} from './entities/stream.entity';

/**
 * The mapper encodes security-relevant rules: ingest credentials (streamKey /
 * rtmpUrl) must never leak to viewers, and playback URLs must be hidden unless
 * the stream is LIVE and the viewer is allowed. These tests lock that contract.
 */
function makeStream(overrides: Partial<Stream> = {}): Stream {
  const base = {
    id: 'stream-1',
    userId: 'creator-1',
    user: undefined,
    title: 'My Stream',
    description: 'desc',
    playbackUrl: 'https://stream.mux.com/abc123.m3u8',
    thumbnailUrl: null,
    status: StreamStatus.LIVE,
    visibility: StreamVisibility.PUBLIC,
    categoryId: 'cat-1',
    chatEnabled: true,
    chatMode: StreamChatMode.ALL,
    recordEnabled: true,
    ageRestricted: false,
    requiredTierId: null,
    slowModeSeconds: 0,
    scheduledAt: null,
    ticketPriceCents: null,
    pinnedMessageId: null,
    viewerCount: 42,
    uniqueViewerCount: 30,
    dvrEnabled: false,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: null,
    createdAt: new Date('2025-12-31T00:00:00Z'),
    streamKey: 'secret-stream-key',
    rtmpUrl: 'rtmp://ingest.example/live',
  };
  return { ...base, ...overrides } as unknown as Stream;
}

describe('toPublicStream', () => {
  it('omits ingest credentials by default (viewer-facing)', () => {
    const result = toPublicStream(makeStream());
    expect(result.streamKey).toBeNull();
    expect(result.rtmpUrl).toBeNull();
  });

  it('includes ingest credentials only when includeIngest=true (owner)', () => {
    const result = toPublicStream(makeStream(), true);
    expect(result.streamKey).toBe('secret-stream-key');
    expect(result.rtmpUrl).toBe('rtmp://ingest.example/live');
  });

  it('exposes playbackUrl when LIVE and not hidden', () => {
    const result = toPublicStream(makeStream({ status: StreamStatus.LIVE }));
    expect(result.playbackUrl).toBe('https://stream.mux.com/abc123.m3u8');
    expect(result.accessDenied).toBe(false);
  });

  it('hides playbackUrl when stream is not LIVE', () => {
    const result = toPublicStream(makeStream({ status: StreamStatus.ENDED }));
    expect(result.playbackUrl).toBeNull();
  });

  it('hides playbackUrl and marks accessDenied when hidePlayback=true even if LIVE', () => {
    const result = toPublicStream(makeStream({ status: StreamStatus.LIVE }), false, {
      hidePlayback: true,
      accessReason: 'tier_required',
    });
    expect(result.playbackUrl).toBeNull();
    expect(result.accessDenied).toBe(true);
    expect(result.accessReason).toBe('tier_required');
  });

  it('prefers opts.playbackUrl override when LIVE', () => {
    const result = toPublicStream(makeStream({ status: StreamStatus.LIVE }), false, {
      playbackUrl: 'https://signed.example/override.m3u8',
    });
    expect(result.playbackUrl).toBe('https://signed.example/override.m3u8');
  });

  it('applies safe defaults for undefined optional fields', () => {
    const result = toPublicStream(
      makeStream({
        visibility: undefined,
        chatEnabled: undefined,
        chatMode: undefined,
        recordEnabled: undefined,
        ageRestricted: undefined,
        slowModeSeconds: undefined,
        uniqueViewerCount: undefined,
        dvrEnabled: undefined,
      }),
    );
    expect(result.visibility).toBe(StreamVisibility.PUBLIC);
    expect(result.chatEnabled).toBe(true);
    expect(result.chatMode).toBe(StreamChatMode.ALL);
    expect(result.recordEnabled).toBe(true);
    expect(result.ageRestricted).toBe(false);
    expect(result.slowModeSeconds).toBe(0);
    expect(result.uniqueViewerCount).toBe(0);
    expect(result.dvrEnabled).toBe(false);
  });

  it('lets opts override scheduledAt/ticketPriceCents/pinnedMessageId', () => {
    const scheduledAt = new Date('2026-02-02T10:00:00Z');
    const result = toPublicStream(makeStream(), false, {
      scheduledAt,
      ticketPriceCents: 1500,
      pinnedMessageId: 'msg-9',
    });
    expect(result.scheduledAt).toEqual(scheduledAt);
    expect(result.ticketPriceCents).toBe(1500);
    expect(result.pinnedMessageId).toBe('msg-9');
  });

  it('derives a Mux thumbnail from playbackUrl when no stored thumbnail', () => {
    const result = toPublicStream(makeStream({ thumbnailUrl: undefined }));
    expect(result.thumbnailUrl).toBe(
      'https://image.mux.com/abc123/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop',
    );
  });

  it('marks reconnecting when LIVE with muxIdleSince set', () => {
    const result = toPublicStream(
      makeStream({ status: StreamStatus.LIVE, muxIdleSince: new Date() } as Partial<Stream>),
    );
    expect(result.reconnecting).toBe(true);
  });

  it('is not reconnecting when muxIdleSince is unset or stream is not LIVE', () => {
    expect(toPublicStream(makeStream({ status: StreamStatus.LIVE })).reconnecting).toBe(false);
    expect(
      toPublicStream(
        makeStream({ status: StreamStatus.ENDED, muxIdleSince: new Date() } as Partial<Stream>),
      ).reconnecting,
    ).toBe(false);
  });

  it('computes reconnectDeadline from the real configured grace period, not a hardcoded guess', () => {
    const idleSince = new Date('2026-01-01T00:00:00.000Z');
    const result = toPublicStream(
      makeStream({ status: StreamStatus.LIVE, muxIdleSince: idleSince } as Partial<Stream>),
      false,
      { reconnectGraceSec: 45 },
    );
    expect(result.reconnectDeadline).toBe('2026-01-01T00:00:45.000Z');
  });

  it('falls back to the platform default grace period when the caller omits reconnectGraceSec', () => {
    const idleSince = new Date('2026-01-01T00:00:00.000Z');
    const result = toPublicStream(
      makeStream({ status: StreamStatus.LIVE, muxIdleSince: idleSince } as Partial<Stream>),
    );
    expect(result.reconnectDeadline).toBe('2026-01-01T00:01:00.000Z');
  });

  it('reconnectDeadline is null when not reconnecting', () => {
    expect(toPublicStream(makeStream({ status: StreamStatus.LIVE })).reconnectDeadline).toBeNull();
  });

  it('surfaces endReason when set', () => {
    const result = toPublicStream(
      makeStream({ status: StreamStatus.ENDED, endReason: StreamEndReason.CONNECTION_LOST } as Partial<Stream>),
    );
    expect(result.endReason).toBe('connection_lost');
  });
});

describe('serializeStreamForCache', () => {
  it('produces JSON that round-trips key fields', () => {
    const json = serializeStreamForCache(makeStream());
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('stream-1');
    expect(parsed.streamKey).toBe('secret-stream-key');
  });
});
