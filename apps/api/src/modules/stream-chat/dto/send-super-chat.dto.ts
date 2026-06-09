import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from 'class-validator';

export class SendSuperChatDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  body: string;

  @ApiProperty({ description: 'Tip amount in cents (USD)' })
  @IsInt()
  @Min(100)
  amountCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  cancelUrl?: string;
}
