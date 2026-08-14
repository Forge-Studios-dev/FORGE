import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

const MAX_SUPER_THANKS_CENTS = 100_000;

export class CreateSuperThanksDto {
  @ApiProperty()
  @IsUUID()
  videoId: string;

  @ApiPropertyOptional({ description: 'Optional message to the creator' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  body?: string;

  @ApiProperty({ description: 'Super Thanks amount in cents (USD)' })
  @IsInt()
  @Min(100)
  @Max(MAX_SUPER_THANKS_CENTS)
  amountCents: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @IsAllowedRedirectUrl()
  successUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @IsAllowedRedirectUrl()
  cancelUrl?: string;
}
