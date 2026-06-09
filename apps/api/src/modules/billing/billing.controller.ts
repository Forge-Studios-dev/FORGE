import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CreateEventCheckoutDto } from './dto/create-event-checkout.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  createCheckout(@CurrentUser() user: { sub: string }, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckout(user.sub, dto);
  }

  @Post('checkout/event')
  createEventCheckout(@CurrentUser() user: { sub: string }, @Body() dto: CreateEventCheckoutDto) {
    return this.billingService.createEventCheckout(user.sub, dto);
  }

  @Public()
  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const payload = req.rawBody ?? Buffer.from('');
    const headers = req.headers as Record<string, string>;
    return this.billingService.handleWebhook(payload, headers);
  }
}
