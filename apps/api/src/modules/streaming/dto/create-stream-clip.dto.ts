import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateStreamClipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Clip start offset from stream start (ms). Omit to mark current moment.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  startOffsetMs?: number;

  @ApiPropertyOptional({ description: 'Clip end offset (ms). Defaults to start + 30s.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  endOffsetMs?: number;
}
