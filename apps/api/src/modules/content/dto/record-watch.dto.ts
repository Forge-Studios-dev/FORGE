import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RecordWatchDto {
  @ApiPropertyOptional({ description: 'Playback position in seconds' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400 * 12)
  progressSeconds?: number;
}
