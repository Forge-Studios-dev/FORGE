import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search videos and users (Postgres FTS with ILIKE fallback)' })
  search(@Query('q') q = '', @Query('limit') limit?: number) {
    return this.searchService.search(q, limit || 20);
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Video title prefix suggestions' })
  suggestions(@Query('q') q = '', @Query('limit') limit?: number) {
    return this.searchService.suggestions(q, limit || 8);
  }
}
