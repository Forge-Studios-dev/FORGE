import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { ThumbnailPresignedDto } from './dto/thumbnail-presigned.dto';
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

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get('studio')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'List all own videos for Studio (every status)' })
  listStudio(@CurrentUser() user: JwtPayload) {
    return this.videosService.listStudioVideos(user.sub);
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

  @Put(':id([0-9a-fA-F-]{36})/upload')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Upload video file via API (fallback when direct S3 PUT fails)',
  })
  proxyUpload(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
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

  @Post(':id([0-9a-fA-F-]{36})/thumbnail/presigned-url')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get presigned S3 URL for custom thumbnail image' })
  getThumbnailPresigned(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ThumbnailPresignedDto,
  ) {
    return this.videosService.getThumbnailPresignedUrl(user.sub, id, dto.contentType);
  }

  @Get(':id([0-9a-fA-F-]{36})/multipart/progress')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Multipart upload progress (server checkpoint)' })
  getMultipartProgress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.getMultipartProgress(user.sub, id);
  }

  @Post(':id([0-9a-fA-F-]{36})/multipart/checkpoint')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record completed S3 parts for resume' })
  checkpointMultipart(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MultipartCheckpointDto,
  ) {
    return this.videosService.checkpointMultipart(user.sub, id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/multipart/parts')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Presigned URLs for S3 multipart upload parts' })
  signMultipartParts(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MultipartPartUrlsDto,
  ) {
    return this.videosService.signMultipartPartUrls(user.sub, id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/multipart/complete')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete S3 multipart upload (assemble object)' })
  completeMultipart(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: MultipartCompletePartsDto,
  ) {
    return this.videosService.completeMultipartParts(user.sub, id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/complete')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete an upload and start processing' })
  complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.videosService.completeUpload(user.sub, id, dto);
  }

  @Post(':id([0-9a-fA-F-]{36})/cancel-upload')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel/remove uploading, processing, or failed video' })
  cancelUpload(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.cancelUpload(user.sub, id);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id([0-9a-fA-F-]{36})/view')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Record a qualified view after watch-time threshold (YouTube-style)',
  })
  recordView(
    @Param('id') id: string,
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

  @Post(':id([0-9a-fA-F-]{36})/watch')
  @Permissions(Permission.USE_LIBRARY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record watch / continue watching' })
  recordWatch(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RecordWatchDto,
  ) {
    return this.videosService.recordWatch(user.sub, id, dto);
  }

  @Patch(':id([0-9a-fA-F-]{36})')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @ApiOperation({ summary: 'Update own video (title, visibility, schedule)' })
  patchVideo(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateVideoDto) {
    return this.videosService.updateVideo(user.sub, id, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Get video by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.videosService.getVideoForViewer(id, user?.sub, user?.role);
  }

  @Post(':id([0-9a-fA-F-]{36})/retry-transcode')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry Mux transcode after failure' })
  retryTranscode(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.retryTranscode(user.sub, id);
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete video' })
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.delete(user.sub, id);
  }
}
