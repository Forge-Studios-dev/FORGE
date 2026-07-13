import { IsOptional, IsUrl, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

export class CreateCheckoutDto {
  @IsUUID()
  creatorId: string;

  @IsUUID()
  tierId: string;

  /** When set, subscription grants access scoped to this community only. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsUrl()
  @IsAllowedRedirectUrl()
  successUrl: string;

  @IsUrl()
  @IsAllowedRedirectUrl()
  cancelUrl: string;
}
