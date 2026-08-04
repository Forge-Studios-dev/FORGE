import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinCommentDto {
  @ApiProperty({ description: 'Pin (true) or unpin (false) the comment' })
  @IsBoolean()
  isPinned!: boolean;
}

export class CreatorHeartCommentDto {
  @ApiProperty({ description: 'Add (true) or remove (false) the creator heart' })
  @IsBoolean()
  creatorHearted!: boolean;
}
