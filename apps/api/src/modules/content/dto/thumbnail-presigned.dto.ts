import { IsIn, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ThumbnailPresignedDto {
  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;
}

export class SetThumbnailUrlDto {
  @ApiPropertyOptional({
    description:
      'Public HTTPS URL for the custom thumbnail (from thumbnail/presigned-url), or null to clear',
    nullable: true,
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  thumbnailUrl: string | null;
}
