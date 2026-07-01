import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CommunityStorageService } from './community-storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3-presigned/upload'),
}));

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

jest.mock('../../common/create-s3-client', () => ({
  createS3ClientForBrowserPresign: jest.fn(() => ({})),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

describe('CommunityStorageService', () => {
  let service: CommunityStorageService;

  const fullConfig: Record<string, unknown> = {
    'aws.region': 'us-east-1',
    'aws.accessKeyId': 'AKIA',
    'aws.secretAccessKey': 'secret',
    'aws.s3BucketName': 'forge-media',
  };

  async function createService(config: Record<string, unknown> = fullConfig) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityStorageService,
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
      ],
    }).compile();
    return module.get(CommunityStorageService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue('https://s3-presigned/upload');
    service = await createService();
  });

  describe('isConfigured', () => {
    it('is true when bucket and access key present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('is false when bucket missing', async () => {
      service = await createService({ ...fullConfig, 'aws.s3BucketName': '' });
      expect(service.isConfigured()).toBe(false);
    });

    it('is false when access key missing', async () => {
      service = await createService({ ...fullConfig, 'aws.accessKeyId': '' });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getPostMediaUploadUrl', () => {
    it('throws when storage not configured', async () => {
      service = await createService({ ...fullConfig, 'aws.s3BucketName': '' });
      await expect(
        service.getPostMediaUploadUrl('comm-1', 'image/png'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unsupported content types', async () => {
      await expect(
        service.getPostMediaUploadUrl('comm-1', 'application/pdf'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('normalizes jpeg extension to jpg in the object key', async () => {
      const result = await service.getPostMediaUploadUrl('comm-1', 'image/jpeg');
      expect(result.key).toBe('community-posts/comm-1/fixed-uuid.jpg');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'forge-media',
          Key: 'community-posts/comm-1/fixed-uuid.jpg',
          ContentType: 'image/jpeg',
        }),
      );
    });

    it('returns a 300s presigned URL and default S3 public URL', async () => {
      const result = await service.getPostMediaUploadUrl('comm-1', 'image/webp');
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 300,
      });
      expect(result.uploadUrl).toBe('https://s3-presigned/upload');
      expect(result.publicUrl).toBe(
        'https://forge-media.s3.amazonaws.com/community-posts/comm-1/fixed-uuid.webp',
      );
    });

    it('uses the CloudFront domain for the public URL when configured', async () => {
      service = await createService({
        ...fullConfig,
        'aws.cloudfrontDomain': 'https://cdn.forge.dev/',
      });
      const result = await service.getPostMediaUploadUrl('comm-1', 'image/png');
      expect(result.publicUrl).toBe('https://cdn.forge.dev/community-posts/comm-1/fixed-uuid.png');
    });
  });
});
