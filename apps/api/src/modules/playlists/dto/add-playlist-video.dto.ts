import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPlaylistVideoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  videoId: string;
}

