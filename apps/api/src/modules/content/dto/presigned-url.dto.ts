import { IsIn, IsNumber, IsString, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PresignedUrlDto {
  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @IsIn(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'])
  contentType: string;

  @ApiProperty({ description: 'File size in bytes', example: 104857600 })
  @Type(() => Number)
  @IsNumber()
  @Max(5 * 1024 * 1024 * 1024) // 5 GB max
  fileSizeBytes: number;
}
