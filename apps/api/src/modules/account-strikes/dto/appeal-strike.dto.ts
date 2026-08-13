import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AppealStrikeDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}
