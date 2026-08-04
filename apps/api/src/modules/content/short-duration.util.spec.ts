import { VideoType } from './entities/video.entity';
import {
  SHORT_TOO_LONG_MESSAGE,
  resolveVideoTypeOnReady,
} from './short-duration.util';

describe('resolveVideoTypeOnReady', () => {
  it('accepts short intent at exactly 60s', () => {
    expect(resolveVideoTypeOnReady(VideoType.SHORT, 60)).toEqual({
      ok: true,
      videoType: VideoType.SHORT,
    });
  });

  it('rejects short intent when duration is 61s', () => {
    expect(resolveVideoTypeOnReady(VideoType.SHORT, 61)).toEqual({
      ok: false,
      reason: SHORT_TOO_LONG_MESSAGE,
    });
  });

  it('keeps short intent when duration is unknown', () => {
    expect(resolveVideoTypeOnReady(VideoType.SHORT, null)).toEqual({
      ok: true,
      videoType: VideoType.SHORT,
    });
  });

  it('auto-classifies video intent ≤60s as short', () => {
    expect(resolveVideoTypeOnReady(VideoType.VIDEO, 45)).toEqual({
      ok: true,
      videoType: VideoType.SHORT,
    });
  });

  it('keeps video intent when longer than 60s', () => {
    expect(resolveVideoTypeOnReady(VideoType.VIDEO, 61)).toEqual({
      ok: true,
      videoType: VideoType.VIDEO,
    });
  });

  it('preserves podcast intent', () => {
    expect(resolveVideoTypeOnReady(VideoType.PODCAST, 30)).toEqual({
      ok: true,
      videoType: VideoType.PODCAST,
    });
  });
});
