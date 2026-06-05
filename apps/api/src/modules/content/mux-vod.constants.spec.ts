import { muxVodIngestJobId } from './mux-vod.constants';

describe('muxVodIngestJobId', () => {
  it('returns stable job id per video for BullMQ idempotency', () => {
    const videoId = '550e8400-e29b-41d4-a716-446655440000';
    expect(muxVodIngestJobId(videoId)).toBe(`mux-ingest-${videoId}`);
    expect(muxVodIngestJobId(videoId)).toBe(muxVodIngestJobId(videoId));
  });
});
