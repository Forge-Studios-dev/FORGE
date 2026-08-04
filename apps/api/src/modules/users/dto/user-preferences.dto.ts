import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdatePrivacyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  watchHistoryPaused?: boolean;
}

export class UpdateInterestsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  categoryIds: string[];
}
