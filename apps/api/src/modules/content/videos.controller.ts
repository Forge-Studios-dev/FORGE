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
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'node:os';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { FeedService, FeedSort } from '../feed/feed.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { ThumbnailPresignedDto, SetThumbnailUrlDto } from './dto/thumbnail-presigned.dto';
import { CaptionPresignedDto, SetCaptionUrlDto } from './dto/caption.dto';
import { RecordWatchDto } from './dto/record-watch.dto';
import { RecordViewDto } from './dto/record-view.dto';
import { Request } from 'express';
import { UpdateVideoDto } from './dto/update-video.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { Throttle } from '@nestjs/throttler';
import { MultipartPartUrlsDto } from './dto/multipart-part-urls.dto';
import { MultipartCompletePartsDto } from './dto/multipart-complete-parts.dto';
import { MultipartCheckpointDto } from './dto/multipart-checkpoint.dto';
import { StudioVideosQueryDto } from './dto/studio-videos-query.dto';
import { RecommendationsService } from './recommendations.service';
import { ContentLibraryService, ContentType } from './content-library.service';

function parseListParam(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly recommendationsService: RecommendationsService,
    private readonly contentLibraryService: ContentLibraryService,
    private readonly feedService: FeedService,
  ) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('shorts')
  @ApiOperation({ summary: 'Paginated public Shorts feed (≤60s, published, public)' })
  listShorts(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videosService.listShorts({
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      viewerId: user?.sub,
    });
  }

  @Get('studio')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({
    summary: 'Creator content library — own videos (every status) with filter/search/sort/pagination',
  })
  listStudio(@CurrentUser() user: JwtPayload, @Query() query: StudioVideosQueryDto) {
    return this.videosService.listStudioVideos(user.sub, query);
  }

  @Post('release-stuck-uploads')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all ghost uploading rows for the current creator' })
  releaseStuck(@CurrentUser() user: JwtPayload) {
    return this.videosService.releaseAllStuckUploads(user.sub);
  }

  @Post('presigned-url')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get presigned S3 URL for video upload' })
  getPresignedUrl(@CurrentUser() user: JwtPayload, @Body() dto: PresignedUrlDto) {
    return this.videosService.getPresignedUploadUrl(user.sub, dto);
  }

  // ── P01-T025: Personalized feed & semantic recommendations ────────────────
  // Static-segment routes below must stay ahead of the `:id` routes further
  // down — Express/NestJS match routes in registration order, and `:id` is
  // an unconstrained single-segment wildcard (path-to-regexp v7+, used by
  // Express 5 / @nestjs/platform-express v11, dropped support for inline
  // regex param constraints like `:id([0-9a-fA-F-]{36})`, which previously
  // made this ordering unnecessary).
  //
  // `feed`, `public`, and `by-skills` specifically live HERE rather than in
  // FeedController: FeedModule imports ContentModule (for VideosService), so
  // Nest's dependency-first module resolution always initializes
  // ContentModule before FeedModule regardless of app.module.ts import
  // order — meaning VideosController's routes always register first no
  // matter what. Declaring these single-segment literals in FeedController
  // would be silently unreachable, shadowed by `:id` below. See
  // route-shadow-order.spec.ts.

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed')
  @ApiOperation({ summary: 'Get paginated public video feed' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'skillTagIds', required: false, description: 'Comma-separated UUIDs' })
  @ApiQuery({ name: 'skillTagSlugs', required: false, description: 'Comma-separated slugs' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['latest', 'popular', 'forYou'] })
  getFeed(
    @Query('categoryId') categoryId?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('skillTagIds') skillTagIds?: string,
    @Query('skillTagSlugs') skillTagSlugs?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
    @Query('sort') sort?: FeedSort,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.feedService.getFeed({
      categoryId,
      categorySlug,
      skillTagIds: parseListParam(skillTagIds),
      skillTagSlugs: parseListParam(skillTagSlugs),
      cursor,
      limit,
      sort,
      userId: user?.sub,
    });
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List discoverable public videos (latest feed)' })
  getPublicVideos(
    @Query('categorySlug') categorySlug?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.getFeed({
      categorySlug,
      cursor,
      limit,
      sort: 'latest',
    });
  }

  @Public()
  @Get('by-skills')
  @ApiOperation({ summary: 'Videos matching skill tags' })
  @ApiQuery({ name: 'skillTagIds', required: false })
  @ApiQuery({ name: 'skillTagSlugs', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getBySkills(
    @Query('skillTagIds') skillTagIds?: string,
    @Query('skillTagSlugs') skillTagSlugs?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.feedService.getFeed({
      skillTagIds: parseListParam(skillTagIds),
      skillTagSlugs: parseListParam(skillTagSlugs),
      cursor,
      limit,
      sort: 'latest',
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('recommended/feed')
  @ApiOperation({ summary: 'Personalized video feed (category affinity + followed creators + trending)' })
  personalizedFeed(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    if (!user) {
      return this.recommendationsService.getTrending(undefined, limit ? Number(limit) : 20);
    }
    return this.recommendationsService.getPersonalizedFeed(user.sub, {
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Trending videos by recent view velocity' })
  trending(@Query('limit') limit?: number) {
    return this.recommendationsService.getTrending(undefined, limit ? Number(limit) : 20);
  }

  // ── P06-T044: Unified content library (Netflix-style) ─────────────────────

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('library')
  @ApiOperation({ summary: 'Unified content library: videos, shorts, podcasts, filtered and sorted' })
  contentLibrary(
    @CurrentUser() user: JwtPayload | undefined,
    @Query('types') types?: string,
    @Query('categoryId') categoryId?: string,
    @Query('creatorId') creatorId?: string,
    @Query('orderBy') orderBy?: 'recent' | 'popular' | 'trending',
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const contentTypes = types
      ? (types.split(',').filter((t) => ['video','short','podcast','course','live'].includes(t)) as ContentType[])
      : undefined;
    return this.contentLibraryService.getUnifiedLibrary(user?.sub, {
      contentTypes,
      categoryId,
      creatorId,
      orderBy,
      limit: limit ? Number(limit) : 24,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('library/creator/:creatorId')
  @ApiOperation({ summary: "A creator's full content library (unified)" })
  creatorLibrary(
    @CurrentUser() user: JwtPayload | undefined,
    @Param('creatorId', ParseUUIDPipe) creatorId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.contentLibraryService.getCreatorLibrary(creatorId, user?.sub, {
      limit: limit ? Number(limit) : 24,
      offset: offset ? Number(offset) : 0,
    });
  }

  @Put(':id/upload')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @UseInterceptors(
    FileInterceptor('file', {
      // Disk-backed, not memoryStorage() — this is a fallback for up-to-500MB
      // uploads and must not buffer the whole file in API process memory (LOW-04).
      storage: diskStorage({ destination: os.tmpdir() }),
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Upload video file via API (fallback when direct S3 PUT fails)',
  })
  proxyUpload(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.videosService.receiveProxyUpload(user.sub, id, file);
  }

  @Post()
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Register video after upload' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVideoDto) {
    return this.videosService.create(user.sub, dto);
  }

  @Post(':id/thumbnail/presigned-url')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get presigned S3 URL for custom thumbnail image' })
  getThumbnailPresigned(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ThumbnailPresignedDto,
  ) {
    return this.videosService.getThumbnailPresignedUrl(user.sub, id, dto.contentType);
  }

  @Put(':id/thumbnail')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Set or clear custom thumbnail URL after S3 PUT' })
  setThumbnail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetThumbnailUrlDto,
  ) {
    return this.videosService.setThumbnailUrl(user.sub, id, dto.thumbnailUrl);
  }

  @Post(':id/caption/presigned-url')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Presigned S3 URL for WebVTT caption upload' })
  getCaptionPresigned(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaptionPresignedDto,
  ) {
    return this.videosService.getCaptionPresignedUrl(
      user.sub,
      id,
      dto.contentType,
      dto.language ?? 'en',
    );
  }

  @Put(':id/caption')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Set or clear a language caption (WebVTT) URL' })
  setCaption(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCaptionUrlDto,
  ) {
    return this.videosService.setCaptionUrl(
      user.sub,
      id,
      dto.captionUrl,
      dto.language ?? 'en',
    );
  }

  @Get(':id/multipart/progress')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Multipart upload progress (server checkpoint)' })
  getMultipartProgress(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.videosService.getMultipartProgress(user.sub, id);
  }

  @Post(':id/multipart/checkpoint')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record completed S3 parts for resume' })
  checkpointMultipart(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCheckpointDto,
  ) {
    return this.videosService.checkpointMultipart(user.sub, id, dto);
  }

  @Post(':id/multipart/parts')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Presigned URLs for S3 multipart upload parts' })
  signMultipartParts(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartPartUrlsDto,
  ) {
    return this.videosService.signMultipartPartUrls(user.sub, id, dto);
  }

  @Post(':id/multipart/complete')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete S3 multipart upload (assemble object)' })
  completeMultipart(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCompletePartsDto,
  ) {
    return this.videosService.completeMultipartParts(user.sub, id, dto);
  }

  @Post(':id/complete')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete an upload and start processing' })
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.videosService.completeUpload(user.sub, id, dto);
  }

  @Post(':id/cancel-upload')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel/remove uploading, processing, or failed video' })
  cancelUpload(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.videosService.cancelUpload(user.sub, id);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Record a qualified view after watch-time threshold (YouTube-style)',
  })
  recordView(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordViewDto,
    @Req() req: Request,
    @CurrentUser() user?: JwtPayload,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
      req.ip ||
      'anon';
    const viewerKey = user?.sub ?? ip;
    return this.videosService.recordQualifiedView(id, viewerKey, dto, user?.sub);
  }

  @Post(':id/watch')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record watch / continue watching' })
  recordWatch(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordWatchDto,
  ) {
    return this.videosService.recordWatch(user.sub, id, dto);
  }

  @Post(':id/not-interested')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hide a video from personalized / signed-in feeds (Not interested)' })
  markNotInterested(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.markNotInterested(user.sub, id);
  }

  @Post(':id/dont-recommend-channel')
  @Permissions(Permission.ENGAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Don’t recommend this video’s channel in feeds (YouTube-style)',
  })
  dontRecommendChannel(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.feedService.muteChannelFromVideo(user.sub, id);
  }

  @Patch(':id')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Update own video (title, visibility, schedule)' })
  patchVideo(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVideoDto) {
    return this.videosService.updateVideo(user.sub, id, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/captions')
  @ApiOperation({ summary: 'Fetch caption WebVTT text (server proxy for transcript UI)' })
  getCaptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('language') language: string | undefined,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.videosService.getCaptionTrackText(id, language, user?.sub, user?.role);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get video by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: JwtPayload) {
    return this.videosService.getVideoForViewer(id, user?.sub, user?.role);
  }

  @Post(':id/retry-transcode')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry Mux transcode after failure' })
  retryTranscode(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.videosService.retryTranscode(user.sub, id);
  }

  @Delete(':id')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete video' })
  delete(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.videosService.delete(user.sub, id);
  }

  @Public()
  @Get(':id/similar')
  @ApiOperation({ summary: 'Videos similar to a given video (same category ranking)' })
  similarVideos(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: number) {
    return this.recommendationsService.getSimilarVideos(id, limit ? Number(limit) : 10);
  }
}
