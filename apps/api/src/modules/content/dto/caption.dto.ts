import { IsIn, IsOptional, IsString, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CAPTION_LANGUAGES = [
  'en',
  'es',
  'hi',
  'pt',
  'fr',
  'de',
  'ja',
  'ko',
  'ar',
] as const;

export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number];

export const CAPTION_LANGUAGE_LABELS: Record<CaptionLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  hi: 'Hindi',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
};

export class CaptionPresignedDto {
  @ApiProperty({ example: 'text/vtt' })
  @IsString()
  @IsIn(['text/vtt', 'text/plain', 'application/octet-stream'])
  contentType: string;

  @ApiPropertyOptional({ enum: CAPTION_LANGUAGES, default: 'en' })
  @IsOptional()
  @IsIn([...CAPTION_LANGUAGES])
  language?: CaptionLanguage;
}

export class SetCaptionUrlDto {
  @ApiPropertyOptional({
    description: 'Public HTTPS URL to a WebVTT file, or null to clear this language (or all if language omitted)',
    nullable: true,
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  captionUrl: string | null;

  @ApiPropertyOptional({ enum: CAPTION_LANGUAGES, default: 'en' })
  @IsOptional()
  @IsIn([...CAPTION_LANGUAGES])
  language?: CaptionLanguage;
}
