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
import { UpdateVideoDto } from './dto/update-video.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/auth/permissions';
import { Throttle } from '@nestjs/throttler';

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

  @Delete(':id([0-9a-fA-F-]{36})')
  @UseGuards(CreatorApprovedGuard)
  @Permissions(Permission.UPLOAD_VIDEO)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete video' })
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.delete(user.sub, id);
  }
}
