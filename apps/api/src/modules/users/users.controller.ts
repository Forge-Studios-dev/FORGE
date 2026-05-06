import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PlaylistsService } from '../playlists/playlists.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly playlistsService: PlaylistsService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get('by-username/:username')
  @ApiOperation({ summary: 'Get user profile by username' })
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.sub, id, dto);
  }

  @Post(':id/avatar-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for avatar upload' })
  getAvatarUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Query('contentType') contentType: string,
  ) {
    return this.usersService.getAvatarUploadUrl(user.sub, contentType);
  }

  @Post('me/request-creator')
  @ApiOperation({ summary: 'Request creator access (sets creator status to pending)' })
  requestCreator(@CurrentUser() user: JwtPayload) {
    return this.usersService.requestCreator(user.sub);
  }

  @Get(':id/videos')
  @ApiOperation({ summary: 'Get videos by user' })
  getUserVideos(
    @Param('id') id: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
    return this.usersService.getUserVideos(id, limit || 20, cursor);
  }

  @Get(':id/playlists')
  @ApiOperation({ summary: 'Get playlists by user' })
  getUserPlaylists(@Param('id') id: string) {
    return this.playlistsService.listByUser(id);
  }
}
