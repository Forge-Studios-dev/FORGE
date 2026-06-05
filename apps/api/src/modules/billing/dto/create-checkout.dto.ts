import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty()
  @IsUUID()
  creatorId: string;

  @ApiProperty()
  @IsUUID()
  tierId: string;
}
