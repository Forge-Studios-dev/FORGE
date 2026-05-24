import { VideoMultipartService } from './video-multipart.service';
import { MULTIPART_PART_SIZE_BYTES } from './video-multipart.constants';

describe('VideoMultipartService', () => {
  const sessionRepo = {
    save: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const service = new VideoMultipartService(
    { get: jest.fn(), setex: jest.fn(), del: jest.fn() } as never,
    { get: jest.fn(() => 'multipart_upload') } as never,
    sessionRepo as never,
  );

  it('computes part count from file size', () => {
    expect(service.partCountForFileSize(MULTIPART_PART_SIZE_BYTES)).toBe(1);
    expect(service.partCountForFileSize(MULTIPART_PART_SIZE_BYTES + 1)).toBe(2);
    expect(service.partCountForFileSize(50 * 1024 * 1024)).toBe(5);
  });

  it('merges completed parts without duplicates', () => {
    const merged = service.mergeCompletedParts(
      [{ partNumber: 1, etag: '"a"' }],
      [{ partNumber: 2, etag: '"b"' }, { partNumber: 1, etag: '"a2"' }],
      3,
    );
    expect(merged).toEqual([
      { partNumber: 1, etag: '"a2"' },
      { partNumber: 2, etag: '"b"' },
    ]);
  });

  it('rejects invalid part numbers', () => {
    expect(() =>
      service.mergeCompletedParts([], [{ partNumber: 0, etag: '"x"' }], 5),
    ).toThrow();
  });

  it('returns null when postgres load fails (schema/migration drift)', async () => {
    sessionRepo.findOne.mockRejectedValueOnce(
      new Error('column VideoMultipartSession.videoId does not exist'),
    );
    const redis = { get: jest.fn().mockResolvedValue(null) };
    const svc = new VideoMultipartService(
      redis as never,
      { get: jest.fn(() => 'multipart_upload') } as never,
      sessionRepo as never,
    );
    await expect(svc.loadState('video-1')).resolves.toBeNull();
  });
});
