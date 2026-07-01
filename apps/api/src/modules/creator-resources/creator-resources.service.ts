import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import {
  CreatorResource,
  ResourceVisibility,
} from './entities/creator-resource.entity';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { createS3Client, createS3ClientForBrowserPresign } from '../../common/create-s3-client';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
]);

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

@Injectable()
export class CreatorResourcesService {
  private readonly presignS3: S3Client;
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnDomain: string | undefined;

  constructor(
    @InjectRepository(CreatorResource)
    private readonly resourceRepository: Repository<CreatorResource>,
    private readonly configService: ConfigService,
    private readonly entitlementsService: EntitlementsService,
  ) {
    const region = configService.get<string>('aws.region') || 'us-east-1';
    const creds = {
      region,
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
    };
    this.presignS3 = createS3ClientForBrowserPresign(creds);
    this.s3 = createS3Client(creds);
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
    this.cdnDomain = configService.get<string>('aws.cloudfrontDomain');
  }

  private isConfigured(): boolean {
    return !!this.bucket && !!this.configService.get<string>('aws.accessKeyId');
  }

  private buildPublicUrl(key: string): string {
    if (this.cdnDomain) {
      return `${this.cdnDomain.replace(/\/$/, '')}/${key}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async getUploadUrl(
    creatorId: string,
    fileName: string,
    mimeType: string,
    fileSizeBytes?: number,
  ) {
    if (!this.isConfigured()) {
      throw new BadRequestException('Resource storage is not configured');
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }
    if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds 500 MB limit');
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const key = `creator-resources/${creatorId}/${uuidv4()}/${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.presignS3, command, { expiresIn: 600 });
    return { uploadUrl, key, fileUrl: this.buildPublicUrl(key) };
  }

  async create(
    creatorId: string,
    input: {
      title: string;
      description?: string;
      fileKey: string;
      fileUrl: string;
      fileName: string;
      mimeType: string;
      fileSizeBytes?: number;
      visibility?: ResourceVisibility;
      requiredTierId?: string;
    },
  ) {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${input.mimeType}`);
    }
    return this.resourceRepository.save(
      this.resourceRepository.create({
        creatorId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileName: input.fileName,
        mimeType: input.mimeType,
        fileSizeBytes: input.fileSizeBytes ?? null,
        visibility: input.visibility ?? ResourceVisibility.SUBSCRIBERS,
        requiredTierId: input.requiredTierId ?? null,
      }),
    );
  }

  async update(
    creatorId: string,
    resourceId: string,
    input: {
      title?: string;
      description?: string;
      visibility?: ResourceVisibility;
      requiredTierId?: string | null;
      isActive?: boolean;
    },
  ) {
    const resource = await this.findOwned(creatorId, resourceId);
    if (input.title !== undefined) resource.title = input.title.trim();
    if (input.description !== undefined) resource.description = input.description.trim() || null;
    if (input.visibility !== undefined) resource.visibility = input.visibility;
    if ('requiredTierId' in input) resource.requiredTierId = input.requiredTierId ?? null;
    if (input.isActive !== undefined) resource.isActive = input.isActive;
    return this.resourceRepository.save(resource);
  }

  async remove(creatorId: string, resourceId: string) {
    const resource = await this.findOwned(creatorId, resourceId);
    if (this.isConfigured()) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: resource.fileKey }),
        );
      } catch {
        // Non-fatal: resource record deleted even if S3 delete fails
      }
    }
    await this.resourceRepository.remove(resource);
    return { success: true };
  }

  async listForCreator(creatorId: string) {
    const resources = await this.resourceRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
    });
    return { data: resources };
  }

  async listPublic(creatorId: string, viewerId?: string | null) {
    const resources = await this.resourceRepository.find({
      where: { creatorId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const viewerSub = viewerId
      ? await this.entitlementsService.hasActiveSubscription(viewerId, creatorId)
      : false;

    return {
      data: resources.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        fileName: r.fileName,
        mimeType: r.mimeType,
        fileSizeBytes: r.fileSizeBytes,
        visibility: r.visibility,
        downloadCount: r.downloadCount,
        createdAt: r.createdAt,
        accessible: this.isAccessible(r, viewerId, viewerSub),
      })),
    };
  }

  async getDownloadUrl(resourceId: string, userId: string) {
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId, isActive: true },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    await this.assertAccess(resource, userId);

    if (!this.isConfigured()) {
      // Dev fallback: return public URL directly
      return { downloadUrl: resource.fileUrl, expiresAt: null };
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: resource.fileKey,
      ResponseContentDisposition: `attachment; filename="${resource.fileName}"`,
    });
    const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    // Fire-and-forget download count increment
    this.resourceRepository
      .increment({ id: resourceId }, 'downloadCount', 1)
      .catch(() => undefined);

    return {
      downloadUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
  }

  private async assertAccess(resource: CreatorResource, userId: string) {
    if (resource.creatorId === userId) return;
    if (resource.visibility === ResourceVisibility.PUBLIC) return;

    const hasSub = await this.entitlementsService.hasActiveSubscription(userId, resource.creatorId);
    if (!hasSub) throw new ForbiddenException('Subscription required to download this resource');

    if (
      resource.visibility === ResourceVisibility.TIER &&
      resource.requiredTierId
    ) {
      const hasTier = await this.entitlementsService.hasTierEntitlement(
        userId,
        resource.creatorId,
        'resource' as never,
        resource.requiredTierId,
      );
      if (!hasTier) {
        throw new ForbiddenException('Your membership tier does not include this resource');
      }
    }
  }

  private isAccessible(
    resource: CreatorResource,
    viewerId: string | null | undefined,
    viewerSub: boolean,
  ): boolean {
    if (resource.visibility === ResourceVisibility.PUBLIC) return true;
    if (!viewerId) return false;
    if (resource.creatorId === viewerId) return true;
    if (resource.visibility === ResourceVisibility.SUBSCRIBERS) return viewerSub;
    return viewerSub; // TIER — exact check done at download time
  }

  private async findOwned(creatorId: string, resourceId: string): Promise<CreatorResource> {
    const resource = await this.resourceRepository.findOne({
      where: { id: resourceId, creatorId },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    return resource;
  }
}
