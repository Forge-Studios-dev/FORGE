import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CreatorResourcesService } from './creator-resources.service';
import { CreatorResource, ResourceVisibility } from './entities/creator-resource.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EngagementService } from '../engagement/engagement.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

describe('CreatorResourcesService', () => {
  let service: CreatorResourcesService;

  const mockResource: CreatorResource = {
    id: 'res-1',
    creatorId: 'creator-1',
    title: 'My PDF',
    description: null,
    fileKey: 'creator-resources/creator-1/uuid/file.pdf',
    fileUrl: 'https://cdn.example.com/creator-resources/creator-1/uuid/file.pdf',
    fileName: 'file.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    visibility: ResourceVisibility.SUBSCRIBERS,
    requiredTierId: null,
    downloadCount: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const resourceRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([mockResource]),
    save: jest.fn(async (entity: Partial<CreatorResource>) => ({ ...mockResource, ...entity })),
    create: jest.fn((dto: Partial<CreatorResource>) => dto),
    remove: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'aws.region': 'us-east-1',
        'aws.accessKeyId': 'key',
        'aws.secretAccessKey': 'secret',
        'aws.s3BucketName': 'forge-bucket',
        'aws.cloudfrontDomain': 'https://cdn.example.com',
      };
      return map[key];
    }),
  };

  const entitlementsService = {
    hasActiveSubscription: jest.fn().mockResolvedValue(true),
    hasTierEntitlement: jest.fn().mockResolvedValue(true),
  };

  const engagementService = {
    isBlockedEitherWay: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorResourcesService,
        { provide: getRepositoryToken(CreatorResource), useValue: resourceRepository },
        { provide: ConfigService, useValue: configService },
        { provide: EntitlementsService, useValue: entitlementsService },
        { provide: EngagementService, useValue: engagementService },
      ],
    }).compile();
    service = module.get(CreatorResourcesService);
  });

  it('returns upload URL for allowed mime type', async () => {
    const result = await service.getUploadUrl('creator-1', 'guide.pdf', 'application/pdf', 1024);
    expect(result.uploadUrl).toContain('s3.example.com');
    expect(result.key).toContain('creator-resources/creator-1');
  });

  it('rejects upload URL for disallowed mime type', async () => {
    await expect(
      service.getUploadUrl('creator-1', 'virus.exe', 'application/octet-stream'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects upload URL for files exceeding 500 MB', async () => {
    await expect(
      service.getUploadUrl('creator-1', 'huge.zip', 'application/zip', 600 * 1024 * 1024),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a resource record', async () => {
    const resource = await service.create('creator-1', {
      title: 'Guide',
      fileKey: 'key',
      fileUrl: 'https://cdn.example.com/key',
      fileName: 'guide.pdf',
      mimeType: 'application/pdf',
    });
    expect(resource.title).toBe('Guide');
    expect(resourceRepository.save).toHaveBeenCalled();
  });

  it('rejects creating resource with invalid mime type', async () => {
    await expect(
      service.create('creator-1', {
        title: 'Bad',
        fileKey: 'key',
        fileUrl: 'url',
        fileName: 'bad.exe',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates resource metadata', async () => {
    resourceRepository.findOne.mockResolvedValue({ ...mockResource });
    const result = await service.update('creator-1', 'res-1', { title: 'New Title' });
    expect(result.title).toBe('New Title');
  });

  it('throws 404 when updating a resource not owned by creator', async () => {
    resourceRepository.findOne.mockResolvedValue(null);
    await expect(
      service.update('other-creator', 'res-1', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists creator resources for studio', async () => {
    resourceRepository.find.mockResolvedValue([mockResource]);
    const result = await service.listForCreator('creator-1');
    expect(result.data).toHaveLength(1);
  });

  it('marks public resources as accessible without login', async () => {
    resourceRepository.find.mockResolvedValue([
      { ...mockResource, visibility: ResourceVisibility.PUBLIC },
    ]);
    const result = await service.listPublic('creator-1', null);
    expect(result.data[0].accessible).toBe(true);
  });

  it('marks subscriber resources as inaccessible when not subscribed', async () => {
    resourceRepository.find.mockResolvedValue([mockResource]);
    entitlementsService.hasActiveSubscription.mockResolvedValue(false);
    const result = await service.listPublic('creator-1', 'user-2');
    expect(result.data[0].accessible).toBe(false);
  });

  it('returns download URL for subscriber who has access', async () => {
    resourceRepository.findOne.mockResolvedValue(mockResource);
    entitlementsService.hasActiveSubscription.mockResolvedValue(true);
    const result = await service.getDownloadUrl('res-1', 'user-2');
    expect(result.downloadUrl).toBe('https://s3.example.com/signed-url');
    expect(result.expiresAt).not.toBeNull();
  });

  it('denies download to non-subscriber', async () => {
    resourceRepository.findOne.mockResolvedValue(mockResource);
    entitlementsService.hasActiveSubscription.mockResolvedValue(false);
    await expect(service.getDownloadUrl('res-1', 'user-99')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows creator to download their own resource without subscription check', async () => {
    resourceRepository.findOne.mockResolvedValue(mockResource);
    const result = await service.getDownloadUrl('res-1', 'creator-1');
    expect(result.downloadUrl).toBeTruthy();
    expect(entitlementsService.hasActiveSubscription).not.toHaveBeenCalled();
  });

  it('throws 404 for non-existent resource', async () => {
    resourceRepository.findOne.mockResolvedValue(null);
    await expect(service.getDownloadUrl('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
