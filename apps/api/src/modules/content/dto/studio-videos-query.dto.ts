import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { VideoStatus, VideoVisibility } from '../entities/video.entity';

export enum StudioVideoSort {
  RECENT = 'recent',
  OLDEST = 'oldest',
  VIEWS = 'views',
  TITLE = 'title',
}

/** Query params for the creator Studio content library (GET /videos/studio). */
export class StudioVideosQueryDto {
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(StudioVideoSort)
  sort?: StudioVideoSort;

  /** Only videos with a future scheduledPublishAt (YouTube Studio “Scheduled”). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  scheduled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
