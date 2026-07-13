import { IsUrl } from 'class-validator';
import { IsAllowedRedirectUrl } from '../../../common/validators/is-allowed-redirect-url.validator';

export class ConnectOnboardQueryDto {
  @IsUrl()
  @IsAllowedRedirectUrl()
  returnUrl: string;
}
