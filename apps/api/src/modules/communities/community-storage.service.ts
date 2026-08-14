import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { createS3ClientForBrowserPresign } from '../../common/create-s3-client';

@Injectable()
export class CommunityStorageService {
  private readonly presignS3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const region = configService.get<string>('aws.region') || 'us-east-1';
    const creds = {
      region,
      accessKeyId: configService.get<string>('aws.accessKeyId') || '',
      secretAccessKey: configService.get<string>('aws.secretAccessKey') || '',
      roleArn: configService.get<string>('aws.roleArn') || undefined,
    };
    this.presignS3 = createS3ClientForBrowserPresign(creds);
    this.bucket = configService.get<string>('aws.s3BucketName') || '';
  }

  isConfigured(): boolean {
    return (
      !!this.bucket &&
      (!!this.configService.get<string>('aws.accessKeyId') ||
        !!this.configService.get<string>('aws.roleArn'))
    );
  }

  async getPostMediaUploadUrl(communityId: string, contentType: string) {
    if (!this.isConfigured()) {
      throw new BadRequestException('Media upload storage is not configured');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(contentType)) {
      throw new BadRequestException('Unsupported image format');
    }

    const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
    const key = `community-posts/${communityId}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.presignS3, command, { expiresIn: 300 });
    const cdnDomain = this.configService.get<string>('aws.cloudfrontDomain');
    const publicUrl = cdnDomain
      ? `${cdnDomain.replace(/\/$/, '')}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl, key };
  }
}
