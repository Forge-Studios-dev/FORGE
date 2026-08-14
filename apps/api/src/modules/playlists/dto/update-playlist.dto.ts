import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PlaylistVisibility } from '../entities/playlist.entity';

export class UpdatePlaylistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ enum: PlaylistVisibility })
  @IsOptional()
  @IsEnum(PlaylistVisibility)
  visibility?: PlaylistVisibility;
}

export class ReorderPlaylistDto {
  @ApiProperty({ type: [String], description: 'Video IDs in desired order' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  videoIds: string[];
}
