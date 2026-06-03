import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetSlowModeDto {
  @ApiProperty({ description: 'Seconds between chat messages (0 = off)' })
  @IsInt()
  @Min(0)
  slowModeSeconds: number;
}
