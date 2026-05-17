import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PresignedUrlDto {
  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsIn(['video/mp4', 'video/quicktime'])
  contentType: string;

  @ApiProperty({ description: 'File size in bytes', example: 104857600 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500 * 1024 * 1024) // 500 MB max (MVP)
  fileSizeBytes: number;
}
