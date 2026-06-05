import { IsString, IsUrl, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  creatorId: string;

  @IsUUID()
  tierId: string;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;
}
