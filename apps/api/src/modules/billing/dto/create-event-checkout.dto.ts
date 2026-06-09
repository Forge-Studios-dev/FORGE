import { IsUrl, IsUUID } from 'class-validator';

export class CreateEventCheckoutDto {
  @IsUUID()
  streamId: string;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;
}
