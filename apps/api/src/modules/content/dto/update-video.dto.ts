import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VideoType, VideoVisibility } from '../entities/video.entity';

export class UpdateVideoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: VideoType, description: 'Explicitly mark video as short or full-length' })
  @IsOptional()
  @IsEnum(VideoType)
  videoType?: VideoType;

  @ApiPropertyOptional({ description: 'ISO8601 — video hidden from feed until this instant' })
  @IsOptional()
  @IsDateString()
  scheduledPublishAt?: string | null;

  @ApiPropertyOptional({
    description:
      'Replace the video\'s topic tags (empty clears tags). All tags must belong to the video\'s current category.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  skillTagIds?: string[];
}
