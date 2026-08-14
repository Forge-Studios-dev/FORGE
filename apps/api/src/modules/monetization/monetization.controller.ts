import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { MonetizationEligibilityService } from './monetization-eligibility.service';
import { CreatorEarningsService } from './creator-earnings.service';

@ApiTags('Monetization')
@Controller()
export class MonetizationController {
  constructor(
    private readonly eligibilityService: MonetizationEligibilityService,
    private readonly earningsService: CreatorEarningsService,
  ) {}

  @Get('creators/me/monetization/eligibility')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'YouTube Partner Program-style monetization eligibility snapshot' })
  getEligibility(@CurrentUser() user: JwtPayload) {
    return this.eligibilityService.getEligibility(user.sub);
  }

  @Get('creators/me/earnings')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Unified earnings summary (subscriptions + Super Chat + Super Thanks)' })
  getEarnings(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.earningsService.getSummary(user.sub, { days: days ? parseInt(days, 10) : undefined });
  }

  @Get('creators/me/earnings/export')
  @UseGuards(CreatorApprovedGuard)
  @ApiOperation({ summary: 'Export unified earnings summary as CSV' })
  async exportEarnings(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('days') days?: string,
  ) {
    const csv = await this.earningsService.exportSummaryCsv(user.sub, {
      days: days ? parseInt(days, 10) : undefined,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="earnings.csv"');
    res.send(csv);
  }
}
