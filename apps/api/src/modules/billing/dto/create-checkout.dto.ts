import { IsOptional, IsUrl, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  successUrl: string;

  @IsUrl()
  cancelUrl: string;
}
