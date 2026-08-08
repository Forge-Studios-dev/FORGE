import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { ReorderPlaylistDto, UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddPlaylistVideoDto } from './dto/add-playlist-video.dto';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { PlaylistSystemType } from './entities/playlist.entity';
import { EngagementService } from '../engagement/engagement.service';

@ApiTags('Playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(
    private readonly playlistsService: PlaylistsService,
    private readonly engagementService: EngagementService,
  ) {}

  @Post()
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Create a playlist' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(
      user.sub,
      dto.title,
      dto.visibility,
      dto.description?.trim() || null,
    );
  }

  @Get('me')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'List playlists for the current user (includes system playlists)' })
  listMine(@CurrentUser() user: JwtPayload) {
    return this.playlistsService.listByUser(user.sub, user.sub);
  }

  @Get('me/watch-later')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Get Watch later playlist' })
  watchLater(@CurrentUser() user: JwtPayload) {
    return this.playlistsService.getSystemPlaylist(
      user.sub,
      PlaylistSystemType.WATCH_LATER,
      user.sub,
    );
  }

  @Get('me/watch-later/contains/:videoId')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Check if a video is in Watch later' })
  async watchLaterContains(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    const inWatchLater = await this.playlistsService.isInWatchLater(user.sub, videoId);
    return { inWatchLater };
  }

  @Get('me/containing/:videoId')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Playlist IDs that already contain this video' })
  containing(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.playlistsService.listPlaylistIdsContainingVideo(user.sub, videoId);
  }

  @Post('me/watch-later/videos')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Add a video to Watch later' })
  addWatchLater(@CurrentUser() user: JwtPayload, @Body() dto: AddPlaylistVideoDto) {
    return this.playlistsService.addToWatchLater(user.sub, dto.videoId);
  }

  @Delete('me/watch-later/videos')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all videos from Watch later' })
  clearWatchLater(@CurrentUser() user: JwtPayload) {
    return this.playlistsService.clearWatchLater(user.sub);
  }

  @Delete('me/watch-later/videos/:videoId')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a video from Watch later' })
  removeWatchLater(
    @CurrentUser() user: JwtPayload,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.playlistsService.removeFromWatchLater(user.sub, videoId);
  }

  @Get('me/liked')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Get Liked videos playlist' })
  liked(@CurrentUser() user: JwtPayload) {
    return this.playlistsService.getSystemPlaylist(
      user.sub,
      PlaylistSystemType.LIKED,
      user.sub,
    );
  }

  @Delete('me/liked/videos')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear Liked videos (unlike all on the Liked shelf)' })
  clearLiked(@CurrentUser() user: JwtPayload) {
    return this.playlistsService.clearLikedVideos(user.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId')
  @ApiOperation({ summary: 'List public playlists for a channel' })
  async listByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() viewer?: JwtPayload,
  ) {
    if (viewer?.sub && viewer.sub !== userId) {
      if (await this.engagementService.isBlockedEitherWay(viewer.sub, userId)) {
        return [];
      }
    }
    return this.playlistsService.listByUser(userId, viewer?.sub);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.playlistsService.findById(id, user?.sub);
  }

  @Patch(':id')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Update playlist title, description, or visibility' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(user.sub, playlistId, dto);
  }

  @Delete(':id')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a playlist' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) playlistId: string,
  ) {
    return this.playlistsService.delete(user.sub, playlistId);
  }

  @Put(':id/reorder')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Reorder videos in a playlist' })
  reorder(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Body() dto: ReorderPlaylistDto,
  ) {
    return this.playlistsService.reorder(user.sub, playlistId, dto.videoIds);
  }

  @Post(':id/videos')
  @Permissions(Permission.USE_LIBRARY)
  @ApiOperation({ summary: 'Add a video to a playlist' })
  addVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Body() dto: AddPlaylistVideoDto,
  ) {
    return this.playlistsService.addVideo(user.sub, playlistId, dto.videoId);
  }

  @Delete(':id/videos/:videoId')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a video from a playlist' })
  removeVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    return this.playlistsService.removeVideo(user.sub, playlistId, videoId);
  }
}
