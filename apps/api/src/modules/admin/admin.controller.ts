import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { ReportsService } from '../reports/reports.service';
import { ReportStatus } from '../reports/entities/report.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminService } from './admin.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

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
    private readonly reportsService: ReportsService,
    private readonly analyticsService: AnalyticsService,
    private readonly categoriesService: CategoriesService,
    private readonly adminService: AdminService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin)' })
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('creatorStatus') creatorStatus?: CreatorStatus,
  ) {
    return this.adminService.listUsers({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search,
      role,
      creatorStatus,
    });
  }

  @Get('users/:id/summary')
  @ApiOperation({ summary: 'User overview stats for admin detail' })
  getUserSummary(@Param('id') id: string) {
    return this.adminService.getUserSummary(id);
  }

  @Get('users/:id/videos')
  @ApiOperation({ summary: 'List all videos by user (any status)' })
  getUserVideos(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: VideoStatus,
  ) {
    return this.adminService.getUserVideos(id, Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('users/:id/reports')
  @ApiOperation({ summary: 'Reports involving this user (filed, received, or on their videos)' })
  getUserReports(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getUserReports(id, Number(page) || 1, Number(limit) || 20);
  }

  @Get('users/:id/watch-history')
  @ApiOperation({ summary: 'Watch history for a user (admin)' })
  getUserWatchHistory(@Param('id') id: string, @Query('limit') limit = 20) {
    return this.adminService.getUserWatchHistory(id, Number(limit) || 20);
  }

  @Get('users/:id/playlists')
  @ApiOperation({ summary: 'Playlists owned by user (admin)' })
  getUserPlaylists(@Param('id') id: string) {
    return this.adminService.getUserPlaylists(id);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user profile (admin)' })
  getUser(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Post('users/:id/impersonate')
  @ApiOperation({ summary: 'Create a short-lived link to sign in on web as this user' })
  impersonateUser(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.createImpersonation(admin.sub, id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user role or status (admin)' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateAdminUserDto) {
    return this.adminService.updateUser(id, dto);
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

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = rows.map((u) => this.adminService.toAdminUserDetail(u));
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
  async getVideos(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: VideoStatus,
    @Query('userId') userId?: string,
  ) {
    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'user')
      .orderBy('v.createdAt', 'DESC');
    if (status) query.andWhere('v.status = :status', { status });
    if (userId) query.andWhere('v.userId = :userId', { userId });
    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Patch('videos/:id')
  @ApiOperation({ summary: 'Update video status (admin)' })
  async updateVideo(
    @Param('id') id: string,
    @Body() dto: { status?: VideoStatus; visibility?: VideoVisibility },
  ) {
    const video = await this.videoRepository.findOne({ where: { id }, relations: ['user'] });
    if (!video) throw new NotFoundException('Video not found');
    Object.assign(video, dto);
    const saved = await this.videoRepository.save(video);
    this.eventEmitter.emit('video.updated', { videoId: id, ...dto });
    return saved;
  }

  @Get('reports')
  @ApiOperation({ summary: 'List user/video reports' })
  getReports(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: ReportStatus,
  ) {
    return this.reportsService.listForAdmin(page, limit, status);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single report (admin)' })
  getReport(@Param('id') id: string) {
    return this.reportsService.findById(id);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Update report status' })
  updateReport(@Param('id') id: string, @Body() dto: { status: ReportStatus }) {
    return this.reportsService.updateStatus(id, dto.status);
  }

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Analytics event counts (last 7 days)' })
  async analyticsSummary() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.analyticsService.summarySince(since);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category (admin)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category (admin)' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category (admin)' })
  deleteCategory(@Param('id') id: string) {
    return this.categoriesService.remove(id);
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
