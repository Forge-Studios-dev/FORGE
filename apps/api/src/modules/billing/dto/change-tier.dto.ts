import { IsUUID } from 'class-validator';

export class ChangeTierDto {
  @IsUUID()
  creatorId: string;

  @IsUUID()
  tierId: string;
}
