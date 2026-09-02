import { IsUrl } from 'class-validator';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

export class CreateProgramCheckoutDto {
  @IsUrl()
  @IsAllowedRedirectUrl()
  successUrl: string;

  @IsUrl()
  @IsAllowedRedirectUrl()
  cancelUrl: string;
}
