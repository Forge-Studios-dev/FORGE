import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ResolveAppealDto {
  @ApiProperty()
  @IsBoolean()
  granted: boolean;
}
