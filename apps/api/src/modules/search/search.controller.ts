import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  SearchService,
  type SearchCaptions,
  type SearchDuration,
  type SearchKind,
  type SearchSort,
  type SearchType,
  type SearchUploaded,
  type SearchWatched,
} from './search.service';
import { Public } from '../../common/decorators/public.decorator';
import { clampLimit } from '../../common/utils/pagination.util';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Search videos, channels, and public playlists (Postgres FTS with ILIKE fallback)',
  })
  @ApiQuery({ name: 'type', required: false, enum: ['all', 'video', 'channel', 'playlist'] })
  @ApiQuery({ name: 'duration', required: false, enum: ['any', 'short', 'medium', 'long'] })
  @ApiQuery({
    name: 'uploaded',
    required: false,
    enum: ['any', 'hour', 'today', 'week', 'month', 'year'],
  })
  @ApiQuery({ name: 'sort', required: false, enum: ['relevance', 'date', 'views'] })
  @ApiQuery({ name: 'captions', required: false, enum: ['any', 'yes'] })
  @ApiQuery({ name: 'kind', required: false, enum: ['any', 'video', 'short'] })
  @ApiQuery({ name: 'watched', required: false, enum: ['any', 'watched', 'unwatched'] })
  search(
    @Query('q') q = '',
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('duration') duration?: string,
    @Query('uploaded') uploaded?: string,
    @Query('sort') sort?: string,
    @Query('captions') captions?: string,
    @Query('kind') kind?: string,
    @Query('watched') watched?: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    const searchType: SearchType =
      type === 'video' || type === 'channel' || type === 'playlist' ? type : 'all';
    const durationFilter: SearchDuration =
      duration === 'short' || duration === 'medium' || duration === 'long' ? duration : 'any';
    const uploadedFilter: SearchUploaded =
      uploaded === 'hour' ||
      uploaded === 'today' ||
      uploaded === 'week' ||
      uploaded === 'month' ||
      uploaded === 'year'
        ? uploaded
        : 'any';
    const sortFilter: SearchSort =
      sort === 'date' || sort === 'views' || sort === 'relevance' ? sort : 'relevance';
    const captionsFilter: SearchCaptions = captions === 'yes' ? 'yes' : 'any';
    const kindFilter: SearchKind = kind === 'video' || kind === 'short' ? kind : 'any';
    const watchedFilter: SearchWatched =
      watched === 'watched' || watched === 'unwatched' ? watched : 'any';
    return this.searchService.search(
      q,
      clampLimit(limit),
      searchType,
      {
        duration: durationFilter,
        uploaded: uploadedFilter,
        sort: sortFilter,
        captions: captionsFilter,
        kind: kindFilter,
        watched: watchedFilter,
      },
      user?.sub,
    );
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('suggestions')
  @ApiOperation({ summary: 'Video title prefix suggestions' })
  suggestions(
    @Query('q') q = '',
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.searchService.suggestions(q, clampLimit(limit, 8, 20), user?.sub);
  }
}
