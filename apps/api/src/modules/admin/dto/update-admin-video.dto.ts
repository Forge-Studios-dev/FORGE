import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ModerationStatus, VideoStatus, VideoVisibility } from '../../content/entities/video.entity';

export class UpdateAdminVideoDto {
  @ApiPropertyOptional({ enum: VideoStatus })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @ApiPropertyOptional({ enum: VideoVisibility })
  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @ApiPropertyOptional({ enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  moderationStatus?: ModerationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderationNote?: string;

  @ApiPropertyOptional({ description: 'Clear scheduled publish time' })
  @IsOptional()
  @IsBoolean()
  clearScheduledPublish?: boolean;
}
