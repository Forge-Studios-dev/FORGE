import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe Checkout session for a membership tier' })
  createCheckout(@CurrentUser() user: JwtPayload, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(user.sub, dto);
  }

  @Post('webhooks/stripe')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Stripe webhook (raw body)' })
  stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
  ) {
    const payload = req.rawBody ?? Buffer.from('');
    return this.billingService.handleStripeWebhook(payload, headers);
  }

  @Post('subscriptions/cancel')
  @ApiOperation({ summary: 'Cancel my paid subscription to a creator' })
  cancelSubscription(@CurrentUser() user: JwtPayload, @Body() dto: CancelSubscriptionDto) {
    return this.billingService.cancelMySubscription(user.sub, dto.creatorId);
  }
}
