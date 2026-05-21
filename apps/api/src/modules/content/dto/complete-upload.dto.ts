import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VideoVisibility } from '../entities/video.entity';

export class CompleteUploadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ type: [String], description: 'Skill tag IDs' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  skillTagIds?: string[];

  @ApiPropertyOptional({ description: 'Resolve skill tag by name (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  skillTagName?: string;

  @ApiPropertyOptional({ description: 'ISO8601 — hide from feed until this instant' })
  @IsOptional()
  @IsDateString()
  scheduledPublishAt?: string;

  @ApiPropertyOptional({ type: [String], description: 'Add video to these playlists after processing' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  playlistIds?: string[];
}

