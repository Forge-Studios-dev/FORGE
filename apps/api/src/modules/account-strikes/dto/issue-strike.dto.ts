import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { StrikeType } from '../entities/account-strike.entity';

export class IssueStrikeDto {
  @ApiProperty({ enum: StrikeType })
  @IsEnum(StrikeType)
  type: StrikeType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceVideoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReportId?: string;
}
