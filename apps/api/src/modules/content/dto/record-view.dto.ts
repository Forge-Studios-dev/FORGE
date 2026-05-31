import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class RecordViewDto {
  @ApiProperty({ description: 'Current playback position in seconds' })
  @IsNumber()
  @Min(0)
  progressSeconds: number;

  @ApiPropertyOptional({ description: 'Total video duration in seconds (from player metadata)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  durationSeconds?: number;
}
