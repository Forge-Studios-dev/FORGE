import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';

@ApiTags('Admin')
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin)' })
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    const query = this.userRepository.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    if (search) {
      query.where('u.email ILIKE :search OR u.username ILIKE :search', { search: `%${search}%` });
    }
    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user role or status (admin)' })
  updateUser(
    @Param('id') id: string,
    @Body() dto: { role?: UserRole; isVerified?: boolean },
  ) {
    return this.userRepository.update(id, dto);
  }

  @Get('videos')
  @ApiOperation({ summary: 'List all videos (admin)' })
  async getVideos(@Query('page') page = 1, @Query('limit') limit = 20, @Query('status') status?: VideoStatus) {
    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'user')
      .orderBy('v.createdAt', 'DESC');
    if (status) query.where('v.status = :status', { status });
    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Patch('videos/:id')
  @ApiOperation({ summary: 'Update video status (admin)' })
  updateVideo(
    @Param('id') id: string,
    @Body() dto: { status?: VideoStatus; visibility?: VideoVisibility },
  ) {
    return this.videoRepository.update(id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform stats (admin)' })
  async getStats() {
    const [userCount, videoCount, readyVideoCount] = await Promise.all([
      this.userRepository.count(),
      this.videoRepository.count(),
      this.videoRepository.count({ where: { status: VideoStatus.READY } }),
    ]);
    return { userCount, videoCount, readyVideoCount };
  }
}
