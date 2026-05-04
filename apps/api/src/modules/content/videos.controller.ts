import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get presigned S3 URL for video upload' })
  getPresignedUrl(@CurrentUser() user: JwtPayload, @Body() dto: PresignedUrlDto) {
    return this.videosService.getPresignedUploadUrl(user.sub, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Register video after upload' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVideoDto) {
    return this.videosService.create(user.sub, dto);
  }

  @Public()
  @Get(':id([0-9a-fA-F-]{36})')
  @ApiOperation({ summary: 'Get video by ID' })
  async findOne(@Param('id') id: string) {
    const video = await this.videosService.findById(id);
    await this.videosService.incrementViewCount(id);
    return video;
  }

  @Delete(':id([0-9a-fA-F-]{36})')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete video' })
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.videosService.delete(user.sub, id);
  }
}
