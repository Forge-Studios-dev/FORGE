import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VideoMultipartService } from './video-multipart.service';
import { MULTIPART_PART_SIZE_BYTES, type MultipartUploadState } from './video-multipart.constants';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example/signed'),
}));

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

  describe('session-backed operations', () => {
    function makeState(overrides: Partial<MultipartUploadState> = {}): MultipartUploadState {
      return {
        userId: 'owner-1',
        uploadId: 'upload-1',
        key: 'videos/owner-1/v1/original.mp4',
        contentType: 'video/mp4',
        partSize: MULTIPART_PART_SIZE_BYTES,
        partCount: 2,
        completedParts: [],
        ...overrides,
      };
    }

    function svcWithState(state: MultipartUploadState | null) {
      const redis = { get: jest.fn().mockResolvedValue(state ? JSON.stringify(state) : null), setex: jest.fn(), del: jest.fn() };
      const svc = new VideoMultipartService(
        redis as never,
        { get: jest.fn(() => 'multipart_upload') } as never,
        sessionRepo as never,
      );
      return { svc, redis };
    }

    describe('getProgress', () => {
      it('throws when the session has expired or never existed', async () => {
        const { svc } = svcWithState(null);
        await expect(svc.getProgress('owner-1', 'v1')).rejects.toThrow(BadRequestException);
      });

      it("throws Forbidden when the caller isn't the session owner", async () => {
        const { svc } = svcWithState(makeState());
        await expect(svc.getProgress('someone-else', 'v1')).rejects.toThrow(ForbiddenException);
      });

      it('returns the completed-part summary for the owner', async () => {
        const { svc } = svcWithState(makeState({ completedParts: [{ partNumber: 1, etag: '"a"' }] }));
        await expect(svc.getProgress('owner-1', 'v1')).resolves.toEqual({
          videoId: 'v1',
          partSize: MULTIPART_PART_SIZE_BYTES,
          partCount: 2,
          completedParts: [{ partNumber: 1, etag: '"a"' }],
          completedCount: 1,
        });
      });
    });

    describe('checkpoint', () => {
      it('throws when the session has expired or never existed', async () => {
        const { svc } = svcWithState(null);
        await expect(svc.checkpoint('owner-1', 'v1', [{ partNumber: 1, etag: '"a"' }])).rejects.toThrow(
          BadRequestException,
        );
      });

      it("throws Forbidden when the caller isn't the session owner", async () => {
        const { svc } = svcWithState(makeState());
        await expect(
          svc.checkpoint('someone-else', 'v1', [{ partNumber: 1, etag: '"a"' }]),
        ).rejects.toThrow(ForbiddenException);
      });

      it('merges the new parts into the saved state', async () => {
        const { svc, redis } = svcWithState(
          makeState({ completedParts: [{ partNumber: 1, etag: '"a"' }] }),
        );
        const result = await svc.checkpoint('owner-1', 'v1', [{ partNumber: 2, etag: '"b"' }]);

        expect(result).toEqual({ completedCount: 2, partCount: 2 });
        expect(redis.setex).toHaveBeenCalled();
      });
    });

    describe('signParts', () => {
      const s3 = { send: jest.fn() };

      it('throws when the session has expired or never existed', async () => {
        const { svc } = svcWithState(null);
        await expect(svc.signParts(s3 as never, 'bucket', 'owner-1', 'v1', [1])).rejects.toThrow(
          BadRequestException,
        );
      });

      it("throws Forbidden when the caller isn't the session owner", async () => {
        const { svc } = svcWithState(makeState());
        await expect(
          svc.signParts(s3 as never, 'bucket', 'someone-else', 'v1', [1]),
        ).rejects.toThrow(ForbiddenException);
      });

      it('rejects part numbers outside the session part count', async () => {
        const { svc } = svcWithState(makeState({ partCount: 2 }));
        await expect(
          svc.signParts(s3 as never, 'bucket', 'owner-1', 'v1', [3]),
        ).rejects.toThrow(BadRequestException);
      });

      it('deduplicates requested part numbers and signs one URL each', async () => {
        const { svc } = svcWithState(makeState({ partCount: 2 }));
        const result = await svc.signParts(s3 as never, 'bucket', 'owner-1', 'v1', [1, 1, 2]);

        expect(result.parts).toEqual([
          { partNumber: 1, uploadUrl: 'https://s3.example/signed' },
          { partNumber: 2, uploadUrl: 'https://s3.example/signed' },
        ]);
      });
    });

    describe('completeParts', () => {
      const s3 = { send: jest.fn().mockResolvedValue({}) };

      beforeEach(() => {
        s3.send.mockClear();
        s3.send.mockResolvedValue({});
      });

      it('throws when the session has expired or never existed', async () => {
        const { svc } = svcWithState(null);
        await expect(
          svc.completeParts(s3 as never, 'bucket', 'owner-1', 'v1', []),
        ).rejects.toThrow(BadRequestException);
      });

      it("throws Forbidden when the caller isn't the session owner", async () => {
        const { svc } = svcWithState(makeState());
        await expect(
          svc.completeParts(s3 as never, 'bucket', 'someone-else', 'v1', []),
        ).rejects.toThrow(ForbiddenException);
        expect(s3.send).not.toHaveBeenCalled();
      });

      it('rejects completion when fewer parts are recorded than expected', async () => {
        const { svc } = svcWithState(
          makeState({ partCount: 2, completedParts: [{ partNumber: 1, etag: '"a"' }] }),
        );
        await expect(
          svc.completeParts(s3 as never, 'bucket', 'owner-1', 'v1', []),
        ).rejects.toThrow(/Expected 2 parts, have 1/);
        expect(s3.send).not.toHaveBeenCalled();
      });

      it('rejects completion when stored parts have a gap despite matching count', async () => {
        // Bypasses mergeCompletedParts' own de-dup to exercise the
        // post-merge contiguity check as an independent safety net.
        const { svc } = svcWithState(
          makeState({
            partCount: 2,
            completedParts: [
              { partNumber: 1, etag: '"a"' },
              { partNumber: 1, etag: '"a-dup"' },
            ],
          }),
        );
        await expect(
          svc.completeParts(s3 as never, 'bucket', 'owner-1', 'v1', []),
        ).rejects.toThrow(/Missing or duplicate part numbers/);
        expect(s3.send).not.toHaveBeenCalled();
      });

      it('assembles the object, quoting bare ETags, and clears the session', async () => {
        const { svc, redis } = svcWithState(
          makeState({ partCount: 2, completedParts: [{ partNumber: 1, etag: '"a"' }] }),
        );

        const result = await svc.completeParts(s3 as never, 'bucket', 'owner-1', 'v1', [
          { partNumber: 2, etag: 'b-no-quotes' },
        ]);

        expect(s3.send).toHaveBeenCalledTimes(1);
        const command = s3.send.mock.calls[0][0];
        expect(command.input).toEqual({
          Bucket: 'bucket',
          Key: 'videos/owner-1/v1/original.mp4',
          UploadId: 'upload-1',
          MultipartUpload: {
            Parts: [
              { PartNumber: 1, ETag: '"a"' },
              { PartNumber: 2, ETag: '"b-no-quotes"' },
            ],
          },
        });
        expect(result).toEqual({ ok: true, key: 'videos/owner-1/v1/original.mp4' });
        expect(redis.del).toHaveBeenCalled();
      });
    });

    describe('abortIfAny', () => {
      const s3 = { send: jest.fn().mockResolvedValue({}) };

      beforeEach(() => {
        s3.send.mockClear();
        s3.send.mockResolvedValue({});
      });

      it('does nothing when there is no active session', async () => {
        const { svc } = svcWithState(null);
        await svc.abortIfAny(s3 as never, 'bucket', 'v1', null);
        expect(s3.send).not.toHaveBeenCalled();
      });

      it('aborts the S3 upload and clears the session', async () => {
        const { svc, redis } = svcWithState(makeState());
        await svc.abortIfAny(s3 as never, 'bucket', 'v1', null);

        expect(s3.send).toHaveBeenCalledTimes(1);
        expect(redis.del).toHaveBeenCalled();
      });

      it('still clears the session when the S3 abort call fails', async () => {
        s3.send.mockRejectedValueOnce(new Error('already aborted'));
        const { svc, redis } = svcWithState(makeState());

        await expect(svc.abortIfAny(s3 as never, 'bucket', 'v1', null)).resolves.toBeUndefined();
        expect(redis.del).toHaveBeenCalled();
      });
    });
  });
});
