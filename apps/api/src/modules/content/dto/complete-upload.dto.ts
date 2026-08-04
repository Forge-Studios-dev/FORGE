import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoType, VideoVisibility } from '../entities/video.entity';

export class CompleteUploadDto {
  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: VideoVisibility })
  @IsEnum(VideoVisibility)
  visibility: VideoVisibility;

  @ApiProperty({ description: 'Primary category for discovery' })
  @IsUUID('4')
  categoryId: string;

  @ApiPropertyOptional({ type: [String], description: 'Optional topic/tag IDs for discovery' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillTagIds?: string[];

  @ApiPropertyOptional({
    enum: [VideoType.VIDEO, VideoType.SHORT],
    description:
      'Creator intent. Shorts must be ≤60s — processing fails if measured duration exceeds 60s. Videos ≤60s may be auto-classified as Short.',
  })
  @IsOptional()
  @IsIn([VideoType.VIDEO, VideoType.SHORT])
  videoType?: VideoType.VIDEO | VideoType.SHORT;

  @ApiPropertyOptional({ description: 'ISO8601 — hide from feed until this instant' })
  @IsOptional()
  @IsDateString()
  scheduledPublishAt?: string;

  @ApiPropertyOptional({ type: [String], description: 'Add video to these playlists after processing' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  playlistIds?: string[];

  /** @deprecated Use skillTagIds — kept for backward compatibility */
  @ApiPropertyOptional({ description: 'Resolve skill tag by name (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  skillTagName?: string;
}
