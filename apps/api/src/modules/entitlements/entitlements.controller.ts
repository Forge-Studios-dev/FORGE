import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EntitlementsService } from './entitlements.service';
import { CreateTierDto, UpdateTierDto, MockSubscriptionDto } from './dto/tier.dto';
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
  cancelSubscription(@CurrentUser() user: JwtPayload, @Param('creatorId') creatorId: string) {
    return this.entitlementsService.cancelMySubscription(user.sub, creatorId);
  }
}
