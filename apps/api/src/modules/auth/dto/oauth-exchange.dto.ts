import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class OAuthExchangeDto {
  @ApiProperty({ description: 'One-time OAuth exchange code from redirect' })
  @IsString()
  @MinLength(32)
  code: string;
}
