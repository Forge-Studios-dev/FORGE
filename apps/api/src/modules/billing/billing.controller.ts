import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { StripeConnectService } from './stripe-connect.service';
import { SubscriptionChangeService } from './subscription-change.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreateEventCheckoutDto } from './dto/create-event-checkout.dto';
import { ChangeTierDto } from './dto/change-tier.dto';
import { CreatePortalSessionDto } from './dto/create-portal-session.dto';
import { ConnectOnboardQueryDto } from './dto/connect-onboard.dto';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { UseGuards } from '@nestjs/common';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly connectService: StripeConnectService,
    private readonly subscriptionChangeService: SubscriptionChangeService,
  ) {}

  @Post('checkout')
  createCheckout(@CurrentUser() user: { sub: string }, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckout(user.sub, dto);
  }

  @Post('checkout/event')
  createEventCheckout(@CurrentUser() user: { sub: string }, @Body() dto: CreateEventCheckoutDto) {
    return this.billingService.createEventCheckout(user.sub, dto);
  }

  @Get('connect/status')
  @UseGuards(CreatorApprovedGuard)
  connectStatus(@CurrentUser() user: { sub: string }) {
    return this.connectService.getConnectStatus(user.sub);
  }

  @Post('connect/onboard')
  @UseGuards(CreatorApprovedGuard)
  connectOnboard(@CurrentUser() user: { sub: string }, @Query() query: ConnectOnboardQueryDto) {
    return this.connectService.createOnboardingLink(user.sub, query.returnUrl);
  }

  @Post('subscriptions/change-tier')
  changeTier(@CurrentUser() user: { sub: string }, @Body() dto: ChangeTierDto) {
    return this.subscriptionChangeService.changeTier(user.sub, dto.creatorId, dto.tierId);
  }

  @Post('portal')
  createPortal(@CurrentUser() user: { sub: string }, @Body() dto: CreatePortalSessionDto) {
    return this.billingService.createBillingPortalSession(user.sub, dto.returnUrl, dto.creatorId);
  }

  @Public()
  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const payload = req.rawBody ?? Buffer.from('');
    const headers = req.headers as Record<string, string>;
    return this.billingService.handleWebhook(payload, headers);
  }
}
