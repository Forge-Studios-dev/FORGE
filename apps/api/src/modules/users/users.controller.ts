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
import { toPublicUser } from './user.mapper';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestCreatorDto } from './dto/request-creator.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PlaylistsService } from '../playlists/playlists.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly playlistsService: PlaylistsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.sub);
    return toPublicUser(profile);
  }

  @Get('me/watch-history')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({
    summary: 'Recently watched videos for current user',
    description:
      'Use incomplete=true for continue-watching (progress under ~90% of duration, ready videos only).',
  })
  getMyWatchHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
    @Query('incomplete') incomplete?: string,
  ) {
    const incompleteOnly = incomplete === 'true' || incomplete === '1';
    return this.usersService.getWatchHistory(user.sub, limit || 20, incompleteOnly);
  }

  @Post('me/request-creator')
  @ApiOperation({ summary: 'Request creator access (sets creator status to pending)' })
  async requestCreator(@CurrentUser() user: JwtPayload, @Body() dto: RequestCreatorDto) {
    const profile = await this.usersService.requestCreator(user.sub, dto.bio);
    return toPublicUser(profile);
  }

  @Public()
  @Get('by-username/:username')
  @ApiOperation({ summary: 'Get user profile by username' })
  async findByUsername(@Param('username') username: string) {
    const profile = await this.usersService.findByUsername(username);
    return toPublicUser(profile);
  }

  @Public()
  @Get(':id/videos')
  @ApiOperation({ summary: 'Get videos by user' })
  getUserVideos(
    @Param('id') id: string,
    @Query('limit') limit: number,
    @Query('cursor') cursor: string,
  ) {
    return this.usersService.getUserVideos(id, limit || 20, cursor);
  }

  @Public()
  @Get(':id/playlists')
  @ApiOperation({ summary: 'Get playlists by user' })
  getUserPlaylists(@Param('id') id: string) {
    return this.playlistsService.listByUser(id);
  }

  @Post(':id/avatar-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for avatar upload' })
  getAvatarUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('contentType') contentType: string,
  ) {
    return this.usersService.getAvatarUploadUrl(user.sub, contentType, id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async findById(@Param('id') id: string) {
    const profile = await this.usersService.findById(id);
    return toPublicUser(profile);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const profile = await this.usersService.update(user.sub, id, dto);
    return toPublicUser(profile);
  }
}
