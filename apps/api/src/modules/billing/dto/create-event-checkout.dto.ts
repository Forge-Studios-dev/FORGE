import { IsUrl, IsUUID } from 'class-validator';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

export class CreateEventCheckoutDto {
  @IsUUID()
  streamId: string;

  @IsUrl()
  @IsAllowedRedirectUrl()
  successUrl: string;

  @IsUrl()
  @IsAllowedRedirectUrl()
  cancelUrl: string;
}
