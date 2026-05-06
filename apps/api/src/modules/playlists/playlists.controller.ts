import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AddPlaylistVideoDto } from './dto/add-playlist-video.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Playlists')
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a playlist' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePlaylistDto) {
    return this.playlistsService.create(user.sub, dto.title);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  findOne(@Param('id') id: string) {
    return this.playlistsService.findById(id);
  }

  @Post(':id/videos')
  @ApiOperation({ summary: 'Add a video to a playlist' })
  addVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id') playlistId: string,
    @Body() dto: AddPlaylistVideoDto,
  ) {
    return this.playlistsService.addVideo(user.sub, playlistId, dto.videoId);
  }

  @Delete(':id/videos/:videoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a video from a playlist' })
  removeVideo(
    @CurrentUser() user: JwtPayload,
    @Param('id') playlistId: string,
    @Param('videoId') videoId: string,
  ) {
    return this.playlistsService.removeVideo(user.sub, playlistId, videoId);
  }
}

