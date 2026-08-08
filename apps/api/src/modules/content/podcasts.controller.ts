import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PodcastsService } from './podcasts.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { SkillEconomyLmsGuard } from '../../common/guards/skill-economy-lms.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Podcasts')
@Controller()
@UseGuards(SkillEconomyLmsGuard)
export class PodcastsController {
  constructor(private readonly podcastsService: PodcastsService) {}

  // ── Creator: series management ─────────────────────────────────────────────

  @UseGuards(CreatorApprovedGuard)
  @Get('creators/me/podcasts')
  @ApiOperation({ summary: 'List my podcast series' })
  listMySeries(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.podcastsService.listSeries(user.sub, { page, limit });
  }

  @UseGuards(CreatorApprovedGuard)
  @Post('creators/me/podcasts')
  @ApiOperation({ summary: 'Create a podcast series' })
  createSeries(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      title: string;
      description?: string;
      coverImageUrl?: string;
      category?: string;
      language?: string;
    },
  ) {
    return this.podcastsService.createSeries(user.sub, body);
  }

  @UseGuards(CreatorApprovedGuard)
  @Patch('creators/me/podcasts/:seriesId')
  @ApiOperation({ summary: 'Update a podcast series' })
  updateSeries(
    @CurrentUser() user: JwtPayload,
    @Param('seriesId') seriesId: string,
    @Body()
    body: Partial<{
      title: string;
      description: string | null;
      coverImageUrl: string | null;
      category: string | null;
      rssEnabled: boolean;
    }>,
  ) {
    return this.podcastsService.updateSeries(user.sub, seriesId, body);
  }

  @UseGuards(CreatorApprovedGuard)
  @Delete('creators/me/podcasts/:seriesId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a podcast series (detaches episodes)' })
  async deleteSeries(@CurrentUser() user: JwtPayload, @Param('seriesId') seriesId: string) {
    await this.podcastsService.deleteSeries(user.sub, seriesId);
  }

  @UseGuards(CreatorApprovedGuard)
  @Post('creators/me/podcasts/:seriesId/episodes')
  @ApiOperation({ summary: 'Attach an existing video as a podcast episode' })
  addEpisode(
    @CurrentUser() user: JwtPayload,
    @Param('seriesId') seriesId: string,
    @Body() body: { videoId: string; episodeNumber?: number; season?: number; showNotes?: string },
  ) {
    return this.podcastsService.addEpisodeToSeries(user.sub, seriesId, body.videoId, body);
  }

  // ── Public: browse ─────────────────────────────────────────────────────────

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('podcasts/:seriesId/episodes')
  @ApiOperation({ summary: 'List episodes in a podcast series (public)' })
  listEpisodes(
    @Param('seriesId') seriesId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.podcastsService.listEpisodes(seriesId, user?.sub);
  }

  @Public()
  @Get('podcasts/:seriesId/rss')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @ApiOperation({ summary: 'RSS feed for podcast series' })
  async rssFeed(@Param('seriesId') seriesId: string, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.podcastsService.generateRssFeed(seriesId, baseUrl);
  }
}
