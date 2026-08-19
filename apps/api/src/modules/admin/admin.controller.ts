import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatorStatus, User, UserRole } from '../users/entities/user.entity';
import { ModerationStatus, Video, VideoStatus } from '../content/entities/video.entity';
import { UpdateAdminVideoDto } from './dto/update-admin-video.dto';
import { UpdateAdminCommunityDto } from './dto/update-admin-community.dto';
import { toAdminVideos } from '../content/video.mapper';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReportsService } from '../reports/reports.service';
import { ReportStatus } from '../reports/entities/report.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateCategoryDto } from '../categories/dto/create-category.dto';
import { UpdateCategoryDto } from '../categories/dto/update-category.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { BulkIdsDto, BulkRejectCreatorsDto, BulkUpdateReportsDto, BulkUpdateUsersDto } from './dto/bulk-admin.dto';
import { AdminService } from './admin.service';
import { DatabaseObservabilityService } from '../../database/database-observability.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { GrantStreamAccessDto } from '../streaming/dto/grant-stream-access.dto';
import { AdminGrantSubscriptionDto } from '../entitlements/dto/tier.dto';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthUserCacheService } from '../auth/auth-user-cache.service';
import { clampLimit, clampPage } from '../../common/utils/pagination.util';
import { AccountStrikesService } from '../account-strikes/account-strikes.service';
import { IssueStrikeDto } from '../account-strikes/dto/issue-strike.dto';
import { ResolveAppealDto } from '../account-strikes/dto/resolve-appeal.dto';
import { AppealStatus, StrikeStatus } from '../account-strikes/entities/account-strike.entity';
import { CopyrightService } from '../copyright/copyright.service';
import { CopyrightNoticeStatus } from '../copyright/entities/copyright-notice.entity';
import { CounterNoticeStatus } from '../copyright/entities/copyright-counter-notice.entity';
import { AdminAuditLogService } from '../../common/audit/admin-audit-log.service';

class RejectCreatorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class UpdateAdminReportStatusDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;
}

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
    private readonly entitlementsService: EntitlementsService,
    private readonly authUserCache: AuthUserCacheService,
    private readonly databaseObservability: DatabaseObservabilityService,
    private readonly accountStrikesService: AccountStrikesService,
    private readonly copyrightService: CopyrightService,
    private readonly adminAuditLog: AdminAuditLogService,
  ) {}

  @Get('audit-log')
  @ApiOperation({ summary: 'Privileged admin action history (strikes, appeals, impersonation, termination, ...)' })
  listAuditLog(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.adminAuditLog.list({ page, limit, action, actorId, targetId });
  }

  @Get('copyright/notices')
  @ApiOperation({ summary: 'List DMCA takedown notices (admin)' })
  listCopyrightNotices(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: CopyrightNoticeStatus,
  ) {
    return this.copyrightService.listNotices({ page: clampPage(page), limit: clampLimit(limit), status });
  }

  @Get('copyright/counter-notices')
  @ApiOperation({ summary: 'List DMCA counter-notices (admin)' })
  listCopyrightCounterNotices(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: CounterNoticeStatus,
  ) {
    return this.copyrightService.listCounterNotices({
      page: clampPage(page),
      limit: clampLimit(limit),
      status,
    });
  }

  @Get('strikes')
  @ApiOperation({ summary: 'List account strikes across all users — defaults to the pending-appeals queue (admin)' })
  listStrikes(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('appealStatus') appealStatus?: AppealStatus,
    @Query('status') status?: StrikeStatus,
  ) {
    return this.accountStrikesService.listAll({
      page: clampPage(page),
      limit: clampLimit(limit),
      appealStatus,
      status,
    });
  }

  @Post('copyright/counter-notices/:id/reject')
  @ApiOperation({
    summary: 'Reject a pending counter-notice (e.g. claimant reported litigation)',
    description: 'Blocks the automatic reinstatement this counter-notice would otherwise get.',
  })
  async rejectCounterNotice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload) {
    const result = await this.copyrightService.rejectCounterNotice(id);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'copyright.counter_notice.reject',
      targetType: 'copyright_counter_notice',
      targetId: id,
    });
    return result;
  }

  @Post('users/:userId/strikes')
  @ApiOperation({ summary: 'Issue an account strike (community-guideline or copyright)' })
  async issueStrike(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: IssueStrikeDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    const strike = await this.accountStrikesService.issueStrike(userId, dto.type, dto.reason, {
      sourceVideoId: dto.sourceVideoId,
      sourceReportId: dto.sourceReportId,
    });
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'strike.issue',
      targetType: 'user',
      targetId: userId,
      reason: dto.reason,
      metadata: { strikeId: strike.id, type: dto.type, consequence: strike.consequence },
    });
    return strike;
  }

  @Get('users/:userId/strikes')
  @ApiOperation({ summary: "List a user's account strikes" })
  listUserStrikes(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.accountStrikesService.listForUser(userId);
  }

  @Patch('strikes/:strikeId/appeal')
  @ApiOperation({ summary: 'Grant or deny a pending strike appeal' })
  async resolveStrikeAppeal(
    @Param('strikeId', ParseUUIDPipe) strikeId: string,
    @Body() dto: ResolveAppealDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    const strike = await this.accountStrikesService.resolveAppeal(strikeId, dto.granted);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'strike.appeal.resolve',
      targetType: 'account_strike',
      targetId: strikeId,
      metadata: { granted: dto.granted },
    });
    return strike;
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin)' })
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('creatorStatus') creatorStatus?: CreatorStatus,
    @Query('isActive') isActive?: string,
    @Query('emailVerified') emailVerified?: string,
    @Query('hasPendingReports') hasPendingReports?: string,
  ) {
    return this.adminService.listUsers({
      page: clampPage(page),
      limit: clampLimit(limit),
      search,
      role,
      creatorStatus,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      emailVerified:
        emailVerified === 'true' ? true : emailVerified === 'false' ? false : undefined,
      hasPendingReports: hasPendingReports === 'true',
    });
  }

  @Get('users/:id/summary')
  @ApiOperation({ summary: 'User overview stats for admin detail' })
  getUserSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserSummary(id);
  }

  @Get('users/:id/videos')
  @ApiOperation({ summary: 'List all videos by user (any status)' })
  getUserVideos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: VideoStatus,
  ) {
    return this.adminService.getUserVideos(id, clampPage(page), clampLimit(limit), status);
  }

  @Get('users/:id/reports')
  @ApiOperation({ summary: 'Reports involving this user (filed, received, or on their videos)' })
  getUserReports(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getUserReports(id, clampPage(page), clampLimit(limit));
  }

  @Get('users/:id/watch-history')
  @ApiOperation({ summary: 'Watch history for a user (admin)' })
  getUserWatchHistory(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit = 20) {
    return this.adminService.getUserWatchHistory(id, clampLimit(limit));
  }

  @Get('users/:id/playlists')
  @ApiOperation({ summary: 'Playlists owned by user (admin)' })
  getUserPlaylists(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserPlaylists(id);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user profile (admin)' })
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.findUserById(id);
  }

  @Post('users/:id/impersonate')
  @ApiOperation({ summary: 'Create a short-lived link to sign in on web as this user' })
  async impersonateUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload) {
    const result = await this.adminService.createImpersonation(admin.sub, id);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'user.impersonate',
      targetType: 'user',
      targetId: id,
    });
    return result;
  }

  @Patch('users/bulk')
  @ApiOperation({ summary: 'Update role/status for multiple users at once (admin)' })
  async bulkUpdateUsers(@Body() dto: BulkUpdateUsersDto, @CurrentUser() admin: JwtPayload) {
    const { ids, ...rest } = dto;
    const result = await this.adminService.bulkUpdateUsers(ids, rest, admin.sub);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'user.bulk_update',
      targetType: 'user',
      targetId: ids.join(','),
      metadata: { ids, ...rest, currentAdminPassword: undefined } as Record<string, unknown>,
    });
    return result;
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user role or status (admin)' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    const result = await this.adminService.updateUser(id, dto, admin.sub);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      metadata: dto as Record<string, unknown>,
    });
    return result;
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft-delete user account (admin)' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload) {
    const result = await this.adminService.deleteUser(id);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'user.delete',
      targetType: 'user',
      targetId: id,
    });
    return result;
  }

  @Post('users/:id/resend-verification')
  @ApiOperation({ summary: 'Resend email verification to user (admin)' })
  resendUserVerification(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.resendUserVerificationEmail(id);
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

    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const [rows, total] = await query
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    const data = rows.map((u) => this.adminService.toAdminUserDetail(u));
    return {
      data,
      meta: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  @Post('creators/bulk-approve')
  @ApiOperation({ summary: 'Approve multiple pending creator requests at once' })
  bulkApproveCreators(@Body() dto: BulkIdsDto) {
    return this.adminService.bulkApproveCreators(dto.ids);
  }

  @Post('creators/bulk-reject')
  @ApiOperation({ summary: 'Reject multiple pending creator requests at once' })
  bulkRejectCreators(@Body() dto: BulkRejectCreatorsDto) {
    return this.adminService.bulkRejectCreators(dto.ids, dto.note);
  }

  @Post('creators/:id/approve')
  @ApiOperation({ summary: 'Approve a creator request' })
  async approveCreator(@Param('id', ParseUUIDPipe) id: string) {
    await this.userRepository.update(id, {
      role: UserRole.CREATOR,
      creatorStatus: CreatorStatus.APPROVED,
      creatorReviewedAt: new Date(),
      creatorReviewNote: null,
      /** MVP: approved creators can upload without a separate email-verify step */
      isVerified: true,
    });
    await this.authUserCache.bust(id);
    this.eventEmitter.emit('creator.approved', { userId: id });
    return { ok: true };
  }

  @Post('creators/:id/reject')
  @ApiOperation({ summary: 'Reject a creator request' })
  async rejectCreator(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectCreatorDto) {
    await this.userRepository.update(id, {
      role: UserRole.CREATOR,
      creatorStatus: CreatorStatus.REJECTED,
      creatorReviewedAt: new Date(),
      creatorReviewNote: dto.note ?? null,
    });
    await this.authUserCache.bust(id);
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
    @Query('moderationStatus') moderationStatus?: ModerationStatus,
  ) {
    const query = this.videoRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.user', 'creator')
      .orderBy('v.createdAt', 'DESC');
    if (status) query.andWhere('v.status = :status', { status });
    if (userId) query.andWhere('v.userId = :userId', { userId });
    if (moderationStatus) query.andWhere('v.moderationStatus = :moderationStatus', { moderationStatus });
    const safePage = clampPage(page);
    const safeLimit = clampLimit(limit);
    const [rows, total] = await query
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();
    return {
      data: toAdminVideos(rows),
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  @Patch('videos/:id')
  @ApiOperation({ summary: 'Moderate or update video (admin)' })
  async updateVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminVideoDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    const result = await this.adminService.moderateVideo(id, admin.sub, dto);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'video.moderate',
      targetType: 'video',
      targetId: id,
      metadata: dto as unknown as Record<string, unknown>,
    });
    return result;
  }

  @Get('reports')
  @ApiOperation({ summary: 'List user/video reports' })
  getReports(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: ReportStatus,
  ) {
    return this.reportsService.listForAdmin(clampPage(page), clampLimit(limit), status);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single report (admin)' })
  getReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findById(id);
  }

  @Patch('reports/bulk')
  @ApiOperation({ summary: 'Update status for multiple reports at once (admin)' })
  async bulkUpdateReports(@Body() dto: BulkUpdateReportsDto, @CurrentUser() admin: JwtPayload) {
    const result = await this.reportsService.bulkUpdateStatus(dto.ids, dto.status);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'report.bulk_update_status',
      targetType: 'report',
      targetId: dto.ids.join(','),
      metadata: { status: dto.status, count: dto.ids.length },
    });
    return result;
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Update report status' })
  async updateReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminReportStatusDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    const result = await this.reportsService.updateStatus(id, dto.status);
    void this.adminAuditLog.record({
      actorId: admin.sub,
      action: 'report.update_status',
      targetType: 'report',
      targetId: id,
      metadata: { status: dto.status },
    });
    return result;
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
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category (admin)' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.remove(id);
  }

  @Get('billing/transactions')
  @ApiOperation({ summary: 'Cross-creator billing ledger — subscriptions + event purchases (admin, read-only)' })
  getBillingLedger(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.getBillingLedger({ page, limit, search });
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

  @Get('database/query-stats')
  @ApiOperation({ summary: 'Top Postgres queries from pg_stat_statements (admin)' })
  getDatabaseQueryStats(@Query('limit') limit = 50) {
    return this.databaseObservability.getTopQueries(clampLimit(limit, 50, 100));
  }

  @Post('database/query-stats/reset')
  @ApiOperation({ summary: 'Reset pg_stat_statements counters (admin)' })
  resetDatabaseQueryStats() {
    return this.databaseObservability.resetQueryStats();
  }

  @Post('subscriptions/grant')
  @ApiOperation({ summary: 'Grant membership to a user (admin)' })
  grantSubscription(@Body() dto: AdminGrantSubscriptionDto) {
    return this.entitlementsService.adminGrantSubscription(dto);
  }

  @Get('streams')
  @ApiOperation({ summary: 'List live streams (admin)' })
  listStreams(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.listStreams({
      status: status as import('../streaming/entities/stream.entity').StreamStatus | undefined,
      page: clampPage(page),
      limit: clampLimit(limit),
    });
  }

  @Post('streams/:id/force-end')
  @ApiOperation({ summary: 'Force end a live stream (admin)' })
  forceEndStream(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: JwtPayload) {
    return this.adminService.forceEndStream(id, admin.sub);
  }

  @Post('streams/:id/grant-access')
  @ApiOperation({ summary: 'Grant paid event access to a user (admin)' })
  grantStreamAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: GrantStreamAccessDto,
  ) {
    return this.adminService.grantStreamAccess(admin.sub, id, dto);
  }

  @Get('streams/:id/chat')
  @ApiOperation({ summary: 'View stream chat for moderation (admin)' })
  getStreamChat(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: JwtPayload,
    @Query('limit') limit = 50,
  ) {
    return this.adminService.getStreamChat(id, admin.sub, admin.role, Number(limit) || 50);
  }

  @Delete('streams/:id/chat/:messageId')
  @ApiOperation({ summary: 'Delete a stream chat message (admin)' })
  deleteStreamChatMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.deleteStreamChatMessage(id, messageId, admin.sub, admin.role);
  }

  @Post('streams/backfill-mux-playback-ids')
  @ApiOperation({ summary: 'Backfill mux_playback_id from playback_url on streams' })
  backfillMuxPlaybackIds() {
    return this.adminService.backfillMuxPlaybackIds();
  }

  @Get('communities')
  @ApiOperation({ summary: 'List communities (admin oversight)' })
  listCommunities(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.listCommunities(clampPage(page), clampLimit(limit), search);
  }

  @Get('communities/:id')
  @ApiOperation({ summary: 'Community detail with member stats and Connect status (admin)' })
  getCommunityDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getCommunityDetail(id);
  }

  @Patch('communities/:id')
  @ApiOperation({ summary: 'Update community visibility or name (admin)' })
  updateCommunity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminCommunityDto) {
    return this.adminService.updateCommunity(id, dto);
  }

  @Get('creators/connect-status')
  @ApiOperation({ summary: 'Stripe Connect onboarding status for creators (admin)' })
  listCreatorConnectStatus(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('filter') filter?: 'all' | 'connected' | 'incomplete' | 'none',
  ) {
    return this.adminService.listCreatorConnectStatus(
      clampPage(page),
      clampLimit(limit),
      search,
      filter ?? 'all',
    );
  }
}
