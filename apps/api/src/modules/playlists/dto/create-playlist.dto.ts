import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlaylistVisibility } from '../entities/playlist.entity';

export class CreatePlaylistDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: PlaylistVisibility })
  @IsOptional()
  @IsEnum(PlaylistVisibility)
  visibility?: PlaylistVisibility;
}
