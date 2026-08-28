import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { toPublicUser, toPublicUserProfile } from './user.mapper';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequestCreatorDto } from './dto/request-creator.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PlaylistsService } from '../playlists/playlists.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { EngagementService } from '../engagement/engagement.service';
import { AdminService } from '../admin/admin.service';
import { AuthService } from '../auth/auth.service';
import {
  CompleteProfileImageUploadDto,
  PresignProfileImageUploadDto,
} from './dto/profile-image-upload.dto';
import {
  UpdateInterestsDto,
  UpdateNotificationPreferencesDto,
  UpdatePrivacyDto,
} from './dto/user-preferences.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly playlistsService: PlaylistsService,
    private readonly engagementService: EngagementService,
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  async getMe(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.sub);
    return toPublicUser(profile);
  }

  @Get('me/export')
  @ApiOperation({
    summary: 'Export current user data (profile, owned videos, watch history)',
    description:
      'DSAR-style self-service export. Does not yet include comments, community posts/messages, or analytics events.',
  })
  async exportMyData(@CurrentUser() user: JwtPayload) {
    const [profile, videos, watchHistory, playlists] = await Promise.all([
      this.usersService.findById(user.sub),
      this.usersService.exportOwnedVideos(user.sub),
      this.usersService.getWatchHistory(user.sub, 1000),
      this.playlistsService.listByUser(user.sub, user.sub),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile: toPublicUser(profile),
      videos,
      watchHistory,
      playlists,
    };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete current user account (self-service)',
    description:
      'Requires currentPassword, or confirmationToken (from POST /auth/account-deletion/request) for Google-OAuth-only accounts that have no usable password. Anonymizes the account, hides owned videos, and ends active streams — same effect as the admin-triggered deletion.',
  })
  async deleteMyAccount(@CurrentUser() user: JwtPayload, @Body() dto: DeleteAccountDto) {
    if (dto.confirmationToken) {
      const tokenValid = this.authService.isAccountDeletionTokenValid(dto.confirmationToken, user.sub);
      if (!tokenValid) {
        throw new UnauthorizedException('Deletion confirmation link expired or invalid — request a new one');
      }
    } else if (dto.currentPassword) {
      const profile = await this.usersService.findById(user.sub);
      const passwordValid = await bcrypt.compare(dto.currentPassword, profile.passwordHash);
      if (!passwordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    } else {
      throw new BadRequestException('currentPassword or confirmationToken is required');
    }
    return this.adminService.deleteUser(user.sub);
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

  @Delete('me/watch-history')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear watch history for the current user' })
  clearMyWatchHistory(@CurrentUser() user: JwtPayload) {
    return this.usersService.clearWatchHistory(user.sub);
  }

  @Delete('me/watch-history/:videoId')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove one video from watch history' })
  removeMyWatchHistoryItem(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.usersService.removeWatchHistoryItem(user.sub, videoId);
  }

  @Get('me/privacy')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Privacy settings (watch history pause, etc.)' })
  getMyPrivacy(@CurrentUser() user: JwtPayload) {
    return this.usersService.getPrivacySettings(user.sub);
  }

  @Put('me/privacy')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Update privacy settings' })
  setMyPrivacy(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdatePrivacyDto,
  ) {
    return this.usersService.setPrivacySettings(user.sub, body);
  }

  @Get('me/notification-preferences')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Notification preferences (muted categories, email digest opt-in)' })
  getMyNotificationPreferences(@CurrentUser() user: JwtPayload) {
    return this.usersService.getNotificationPreferences(user.sub);
  }

  @Put('me/notification-preferences')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Update notification preferences' })
  setMyNotificationPreferences(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.usersService.setNotificationPreferences(user.sub, body);
  }

  @Post('me/request-creator')
  @ApiOperation({ summary: 'Request creator access (sets creator status to pending)' })
  async requestCreator(@CurrentUser() user: JwtPayload, @Body() dto: RequestCreatorDto) {
    const profile = await this.usersService.requestCreator(user.sub, dto.bio);
    return toPublicUser(profile);
  }

  @Post('me/mature-content/acknowledge')
  @ApiOperation({ summary: 'Acknowledge mature content access (18+)' })
  async acknowledgeMatureContent(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.acknowledgeMatureContent(user.sub);
    return toPublicUser(profile);
  }

  @Get('me/interests')
  @ApiOperation({ summary: 'Cold-start interest category IDs for recommendations' })
  getMyInterests(@CurrentUser() user: JwtPayload) {
    return this.usersService.getInterestCategoryIds(user.sub).then((categoryIds) => ({
      categoryIds,
    }));
  }

  @Put('me/interests')
  @ApiOperation({ summary: 'Save cold-start interest category IDs' })
  setMyInterests(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateInterestsDto,
  ) {
    return this.usersService.setInterestCategoryIds(user.sub, body.categoryIds);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('by-username/:username')
  @ApiOperation({ summary: 'Get user profile by username' })
  async findByUsername(
    @Param('username') username: string,
    @CurrentUser() viewer?: JwtPayload,
  ) {
    const profile = await this.usersService.findByUsername(username);
    const isSelf = viewer?.sub === profile.id;
    // @Public() — reachable by anyone including anonymous visitors, so email
    // (part of toPublicUser's shape) must never leak here except to the owner.
    const publicUser = isSelf ? toPublicUser(profile) : toPublicUserProfile(profile);
    if (viewer?.sub && !isSelf) {
      const viewerBlocked = await this.engagementService.hasBlocked(viewer.sub, profile.id);
      // They blocked you (and you did not block them) → channel unavailable (YouTube parity).
      if (
        !viewerBlocked &&
        (await this.engagementService.isBlockedEitherWay(viewer.sub, profile.id))
      ) {
        throw new ForbiddenException('This channel is not available');
      }
      const viewerFollowing = viewerBlocked
        ? false
        : await this.engagementService.isFollowing(viewer.sub, profile.id);
      return {
        ...publicUser,
        viewerFollowing,
        viewerSubscribed: viewerFollowing,
        viewerBlocked,
      };
    }
    return publicUser;
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username or display name (for mod/grant picker)' })
  searchUsers(@Query('q') q: string, @Query('limit') limit?: number) {
    return this.usersService.searchUsersForPicker(q ?? '', Number(limit) || 10);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/followers')
  @ApiOperation({ summary: 'List channel subscribers (legacy alias; prefer GET /channels/:id/subscribers)' })
  getFollowers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @CurrentUser() viewer?: JwtPayload,
  ) {
    return this.engagementService.getFollowers(id, limit || 20, cursor, viewer?.sub, viewer?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/following')
  @ApiOperation({ summary: 'List channel subscriptions (legacy alias; prefer GET /channels/:id/subscriptions)' })
  getFollowing(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @CurrentUser() viewer?: JwtPayload,
  ) {
    return this.engagementService.getFollowing(id, limit || 20, cursor, viewer?.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/videos')
  @ApiOperation({ summary: 'Get videos by user' })
  async getUserVideos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @Query('type') type?: string,
    @Query('sort') sort?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (user?.sub && user.sub !== id) {
      if (await this.engagementService.isBlockedEitherWay(user.sub, id)) {
        return { data: [], meta: { cursor: null, hasMore: false } };
      }
    }
    const videoType =
      type === 'short' || type === 'video' || type === 'all' ? type : 'all';
    const videoSort =
      sort === 'oldest' || sort === 'popular' || sort === 'newest' ? sort : 'newest';
    return this.usersService.getUserVideos(
      id,
      limit || 20,
      cursor,
      user?.sub,
      videoType,
      videoSort,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/playlists')
  @ApiOperation({ summary: 'Get playlists by user' })
  async getUserPlaylists(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: JwtPayload) {
    if (user?.sub && user.sub !== id) {
      if (await this.engagementService.isBlockedEitherWay(user.sub, id)) {
        return [];
      }
    }
    return this.playlistsService.listByUser(id, user?.sub);
  }

  @Post(':id/avatar-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for avatar upload' })
  getAvatarUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignProfileImageUploadDto,
  ) {
    return this.usersService.getAvatarUploadUrl(user.sub, dto, id);
  }

  @Post(':id/avatar-upload-complete')
  @ApiOperation({ summary: 'Finalize avatar upload after successful object PUT' })
  completeAvatarUpload(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteProfileImageUploadDto,
  ) {
    return this.usersService.completeAvatarUpload(user.sub, dto.key, id);
  }

  @Post(':id/banner-upload-url')
  @ApiOperation({ summary: 'Get presigned URL for channel banner upload' })
  getBannerUploadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignProfileImageUploadDto,
  ) {
    return this.usersService.getBannerUploadUrl(user.sub, dto, id);
  }

  @Post(':id/banner-upload-complete')
  @ApiOperation({ summary: 'Finalize banner upload after successful object PUT' })
  completeBannerUpload(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteProfileImageUploadDto,
  ) {
    return this.usersService.completeBannerUpload(user.sub, dto.key, id);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer?: JwtPayload,
  ) {
    const profile = await this.usersService.findById(id);
    const isSelf = viewer?.sub === profile.id;
    // @Public() — reachable by anyone including anonymous visitors, so email
    // (part of toPublicUser's shape) must never leak here except to the owner.
    const publicUser = isSelf ? toPublicUser(profile) : toPublicUserProfile(profile);
    if (viewer?.sub && !isSelf) {
      const viewerBlocked = await this.engagementService.hasBlocked(viewer.sub, profile.id);
      if (
        !viewerBlocked &&
        (await this.engagementService.isBlockedEitherWay(viewer.sub, profile.id))
      ) {
        throw new ForbiddenException('This channel is not available');
      }
      const viewerFollowing = viewerBlocked
        ? false
        : await this.engagementService.isFollowing(viewer.sub, profile.id);
      return {
        ...publicUser,
        viewerFollowing,
        viewerSubscribed: viewerFollowing,
        viewerBlocked,
      };
    }
    return publicUser;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user profile' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const profile = await this.usersService.update(user.sub, id, dto);
    return toPublicUser(profile);
  }
}
