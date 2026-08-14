import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendDirectMessageDto {
  @ApiProperty()
  @IsUUID()
  recipientId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}

export class MarkConversationReadDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class CreateGroupDmDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ type: [String], minItems: 2, maxItems: 24 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(24)
  @IsUUID('4', { each: true })
  memberIds: string[];
}

export class AddGroupMemberDto {
  @ApiProperty()
  @IsUUID()
  userId: string;
}

export class SendGroupMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}
