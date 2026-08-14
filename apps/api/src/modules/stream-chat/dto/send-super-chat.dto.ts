import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';

/** $1000 cap — a sane upper bound against fat-finger/typo input, not a fraud control (charge is via Stripe Checkout with the user's own payment method). */
const MAX_SUPER_CHAT_AMOUNT_CENTS = 100_000;

export class SendSuperChatDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  body: string;

  @ApiProperty({ description: 'Super Chat amount in cents (USD)' })
  @IsInt()
  @Min(100)
  @Max(MAX_SUPER_CHAT_AMOUNT_CENTS)
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
