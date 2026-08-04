import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class PresignProfileImageUploadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  contentType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  fileSizeBytes: number;
}

export class CompleteProfileImageUploadDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  key: string;
}
