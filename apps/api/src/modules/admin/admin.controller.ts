import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatorStatus, User, UserRole } from '../users/entities/user.entity';
import { Video, VideoStatus, VideoVisibility } from '../content/entities/video.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@ApiTags('Admin')
@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly eventEmitter: EventEmitter2,
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

  @Get('creators/pending')
  @ApiOperation({ summary: 'List pending creator requests' })
  async getPendingCreators(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    const query = this.userRepository
      .createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.CREATOR })
      .andWhere('u.creatorStatus = :status', { status: CreatorStatus.PENDING })
      .orderBy('u.creatorRequestedAt', 'DESC');

    if (search) {
      query.andWhere('u.email ILIKE :search OR u.username ILIKE :search', { search: `%${search}%` });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Post('creators/:id/approve')
  @ApiOperation({ summary: 'Approve a creator request' })
  async approveCreator(@Param('id') id: string) {
    await this.userRepository.update(id, {
      role: UserRole.CREATOR,
      creatorStatus: CreatorStatus.APPROVED,
      creatorReviewedAt: new Date(),
      creatorReviewNote: null,
    });
    this.eventEmitter.emit('creator.approved', { userId: id });
    return { ok: true };
  }

  @Post('creators/:id/reject')
  @ApiOperation({ summary: 'Reject a creator request' })
  async rejectCreator(@Param('id') id: string, @Body() dto: { note?: string }) {
    await this.userRepository.update(id, {
      role: UserRole.CREATOR,
      creatorStatus: CreatorStatus.REJECTED,
      creatorReviewedAt: new Date(),
      creatorReviewNote: dto.note ?? null,
    });
    this.eventEmitter.emit('creator.rejected', { userId: id, note: dto.note ?? null });
    return { ok: true };
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
    this.eventEmitter.emit('video.updated', { videoId: id, ...dto });
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
