import { IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoVisibility } from '../entities/video.entity';

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
