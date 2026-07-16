import { IsOptional, IsUrl, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

export class CreatePortalSessionDto {
  @IsUrl()
  @IsAllowedRedirectUrl()
  returnUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  creatorId?: string;
}
