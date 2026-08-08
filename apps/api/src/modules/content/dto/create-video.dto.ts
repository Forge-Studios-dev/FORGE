import { IsArray, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoVisibility } from '../entities/video.entity';

/** Presigned / proxy uploads always land under videos/{userId}/{videoId}/original.(mp4|mov). */
export const OWNED_VIDEO_S3_KEY_PATTERN =
  /^videos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/original\.(mp4|mov)$/i;

export class CreateVideoDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'S3 object key of the uploaded raw video' })
  @IsString()
  @Matches(OWNED_VIDEO_S3_KEY_PATTERN, {
    message: 's3Key must be videos/{userId}/{videoId}/original.(mp4|mov)',
  })
  s3Key: string;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ type: [String], description: 'Skill tag IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillTagIds?: string[];
}
