import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EntitlementsService } from './entitlements.service';
import { CreateTierDto, UpdateTierDto, MockSubscriptionDto, CreateTierEntitlementDto, CreatorGrantSubscriptionDto } from './dto/tier.dto';
import { MemberSubscriptionStatus } from './entities/member-subscription.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';

@ApiTags('Entitlements')
@Controller()
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Public()
  @Get('creators/:creatorId/tiers')
  @ApiOperation({ summary: 'List active membership tiers for a creator' })
  listTiers(@Param('creatorId') creatorId: string) {
    return this.entitlementsService.listTiersForCreator(creatorId);
  }

  @Post('creators/me/tiers')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Create a membership tier' })
  createTier(@CurrentUser() user: JwtPayload, @Body() dto: CreateTierDto) {
    return this.entitlementsService.createTier(user.sub, dto);
  }

  @Patch('creators/me/tiers/:tierId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Update a membership tier' })
  updateTier(
    @CurrentUser() user: JwtPayload,
    @Param('tierId') tierId: string,
    @Body() dto: UpdateTierDto,
  ) {
    return this.entitlementsService.updateTier(user.sub, tierId, dto);
  }

  @Delete('creators/me/tiers/:tierId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Deactivate a membership tier' })
  deleteTier(@CurrentUser() user: JwtPayload, @Param('tierId') tierId: string) {
    return this.entitlementsService.deleteTier(user.sub, tierId);
  }

  @Get('subscriptions/me')
  @ApiOperation({ summary: 'List my active memberships' })
  mySubscriptions(@CurrentUser() user: JwtPayload) {
    return this.entitlementsService.listMySubscriptions(user.sub);
  }

  @Get('creators/:creatorId/membership/me')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'My membership status for a creator' })
  myMembershipForCreator(
    @Param('creatorId') creatorId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    if (!user?.sub) return { active: false };
    return this.entitlementsService.getMembershipForViewer(user.sub, creatorId);
  }

  @Post('subscriptions/mock')
  @ApiOperation({ summary: 'Grant mock membership (non-prod / feature flag)' })
  mockSubscribe(@CurrentUser() user: JwtPayload, @Body() dto: MockSubscriptionDto) {
    return this.entitlementsService.mockSubscribe(user.sub, dto);
  }

  @Delete('subscriptions/me/:creatorId')
  @ApiOperation({ summary: 'Cancel membership for a creator' })
  cancelSubscription(
    @CurrentUser() user: JwtPayload,
    @Param('creatorId') creatorId: string,
    @Query('cancelAtPeriodEnd') cancelAtPeriodEnd?: string,
  ) {
    return this.entitlementsService.cancelMySubscription(
      user.sub,
      creatorId,
      cancelAtPeriodEnd === 'true',
    );
  }

  @Get('creators/me/subscribers/analytics')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Subscriber analytics summary for creator dashboard' })
  subscriberAnalytics(@CurrentUser() user: JwtPayload) {
    return this.entitlementsService.getSubscriberAnalytics(user.sub);
  }

  @Get('creators/me/subscribers')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List active subscribers for creator' })
  listSubscribers(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit = 50,
    @Query('offset') offset = 0,
    @Query('status') status?: MemberSubscriptionStatus,
  ) {
    return this.entitlementsService.listSubscribersForCreator(user.sub, {
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      status,
    });
  }

  @Get('creators/me/subscribers/export')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Export subscribers as CSV' })
  async exportSubscribers(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.entitlementsService.exportSubscribersCsv(user.sub);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
    res.send(csv);
  }

  @Post('creators/me/subscribers/grant')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Grant comp membership to a user (creator)' })
  grantSubscriber(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatorGrantSubscriptionDto,
  ) {
    return this.entitlementsService.creatorGrantSubscription(user.sub, dto);
  }

  @Post('creators/me/subscribers/:subscriptionId/suspend')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Suspend a subscriber membership' })
  suspendSubscriber(
    @CurrentUser() user: JwtPayload,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.entitlementsService.suspendSubscriber(user.sub, subscriptionId);
  }

  @Get('creators/me/tiers/:tierId/entitlements')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'List tier entitlements' })
  listTierEntitlements(@CurrentUser() user: JwtPayload, @Param('tierId') tierId: string) {
    return this.entitlementsService.listTierEntitlements(user.sub, tierId);
  }

  @Post('creators/me/tiers/:tierId/entitlements')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Add tier entitlement' })
  addTierEntitlement(
    @CurrentUser() user: JwtPayload,
    @Param('tierId') tierId: string,
    @Body() dto: CreateTierEntitlementDto,
  ) {
    return this.entitlementsService.addTierEntitlement(user.sub, tierId, dto);
  }

  @Delete('creators/me/tiers/:tierId/entitlements/:entitlementId')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Remove tier entitlement' })
  removeTierEntitlement(
    @CurrentUser() user: JwtPayload,
    @Param('tierId') tierId: string,
    @Param('entitlementId') entitlementId: string,
  ) {
    return this.entitlementsService.removeTierEntitlement(user.sub, tierId, entitlementId);
  }
}
