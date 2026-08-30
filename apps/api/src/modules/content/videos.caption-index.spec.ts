import { VideosService } from './videos.service';
import { Video } from './entities/video.entity';

/**
 * Locks the contract for transcript indexing: setCaptionUrl best-effort
 * fetches caption track WebVTT (all languages, capped), strips to plain text,
 * and stores it in captionText (folded into search_vector by migration
 * 2050000000000-video-caption-text-search.ts). A fetch failure must never
 * block the caption-url write itself.
 */
describe('VideosService.setCaptionUrl — transcript indexing', () => {
  const videoRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (v: Video) => v),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
  const bustVideoDetailCache = jest.fn().mockResolvedValue(undefined);
  const mapToPublicVideo = jest.fn((v: Video) => v);

  const svc = Object.create(VideosService.prototype) as VideosService;
  Object.assign(svc, {
    videoRepository,
    bustVideoDetailCache,
    mapToPublicVideo,
    cdnDomain: '',
    bucket: '',
    logger: { warn: jest.fn() },
  });

  const originalFetch = global.fetch;

  const makeVideo = (): Video =>
    ({ id: 'v1', userId: 'u1', captionTracks: null, captionUrl: null, captionText: null }) as Video;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRepository.findOne.mockResolvedValue(makeVideo());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches and stores plain-text transcript on a valid caption URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello and welcome.\n',
    }) as never;

    const result = await svc.setCaptionUrl(
      'u1',
      'v1',
      'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
      'en',
    );

    expect(videoRepository.save).toHaveBeenCalled();
    const saved = videoRepository.save.mock.calls[0][0] as Video;
    expect(saved.captionText).toBe('Hello and welcome.');
    expect(result).toBeTruthy();
  });

  it('indexes every language track into captionText', async () => {
    videoRepository.findOne.mockResolvedValue({
      ...makeVideo(),
      captionTracks: [
        {
          language: 'en',
          label: 'English',
          url: 'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
        },
      ],
      captionUrl: 'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
    });

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const text = url.includes('-es.')
        ? 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHola mundo.\n'
        : 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world.\n';
      return { ok: true, text: async () => text };
    }) as never;

    await svc.setCaptionUrl(
      'u1',
      'v1',
      'https://forge-media.s3.amazonaws.com/captions/v1-es.vtt',
      'es',
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const saved = videoRepository.save.mock.calls[0][0] as Video;
    expect(saved.captionText).toContain('Hello world.');
    expect(saved.captionText).toContain('Hola mundo.');
    expect(saved.captionTracks).toHaveLength(2);
  });

  it('reindexCaptionSearchText folds existing tracks after Mux updates', async () => {
    videoRepository.findOne.mockResolvedValue({
      ...makeVideo(),
      captionTracks: [
        {
          language: 'en',
          label: 'English',
          url: 'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
        },
        {
          language: 'hi',
          label: 'Hindi',
          url: 'https://forge-media.s3.amazonaws.com/captions/v1-hi.vtt',
        },
      ],
    });
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const text = url.includes('-hi.')
        ? 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nNamaste.\n'
        : 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello.\n';
      return { ok: true, text: async () => text };
    }) as never;

    await svc.reindexCaptionSearchText('v1');

    expect(videoRepository.update).toHaveBeenCalledWith('v1', {
      captionText: 'Hello.\nNamaste.',
    });
    expect(bustVideoDetailCache).toHaveBeenCalledWith('v1');
  });

  it('backfillCaptionSearchText reindexes videos missing caption_text', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'v1' }]),
    };
    videoRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
    videoRepository.findOne
      .mockResolvedValueOnce({
        ...makeVideo(),
        captionTracks: [
          {
            language: 'en',
            label: 'English',
            url: 'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
          },
        ],
      })
      .mockResolvedValueOnce({ id: 'v1', captionText: 'Hello.' } as Video);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello.\n',
    }) as never;

    const result = await svc.backfillCaptionSearchText(10);

    expect(result).toEqual({ scanned: 1, updated: 1 });
    expect(videoRepository.update).toHaveBeenCalled();
  });

  it('does not block the write when the caption fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never;

    await svc.setCaptionUrl(
      'u1',
      'v1',
      'https://forge-media.s3.amazonaws.com/captions/v1-en.vtt',
      'en',
    );

    expect(videoRepository.save).toHaveBeenCalled();
    const saved = videoRepository.save.mock.calls[0][0] as Video;
    expect(saved.captionText).toBeNull();
  });

  it('clears captionText when the caption is removed', async () => {
    videoRepository.findOne.mockResolvedValue({
      ...makeVideo(),
      captionTracks: [{ language: 'en', label: 'English', url: 'https://forge-media.s3.amazonaws.com/c.vtt' }],
      captionText: 'stale transcript',
    });

    await svc.setCaptionUrl('u1', 'v1', null, 'en');

    const saved = videoRepository.save.mock.calls[0][0] as Video;
    expect(saved.captionText).toBeNull();
  });

  it('rejects an SSRF-unsafe caption host without ever fetching it', async () => {
    global.fetch = jest.fn() as never;

    await svc.setCaptionUrl('u1', 'v1', 'https://attacker.example.com/evil.vtt', 'en');

    expect(global.fetch).not.toHaveBeenCalled();
    const saved = videoRepository.save.mock.calls[0][0] as Video;
    expect(saved.captionText).toBeNull();
  });
});
