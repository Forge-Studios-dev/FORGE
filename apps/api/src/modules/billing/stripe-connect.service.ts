import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  isEnabled(): boolean {
    const provider = (this.configService.get<string>('billing.provider') || 'stub').toLowerCase();
    return provider === 'stripe' && !!this.configService.get<string>('billing.stripeSecretKey');
  }

  private client(): Stripe {
    if (!this.stripe) {
      const key = this.configService.get<string>('billing.stripeSecretKey')?.trim();
      if (!key) throw new BadRequestException('Stripe is not configured');
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  private async resolveAccountId(creatorId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { id: creatorId } });
    return user?.stripeConnectAccountId ?? null;
  }

  async getConnectStatus(creatorId: string) {
    if (!this.isEnabled()) {
      return {
        creatorId,
        connected: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        message: 'Stripe billing is not enabled',
      };
    }

    const accountId = await this.resolveAccountId(creatorId);
    if (!accountId) {
      return {
        creatorId,
        connected: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        message: 'Complete Stripe Connect onboarding to receive payouts',
      };
    }

    try {
      const account = await this.client().accounts.retrieve(accountId);
      return {
        creatorId,
        connected: true,
        accountId,
        payoutsEnabled: account.payouts_enabled ?? false,
        chargesEnabled: account.charges_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
        message: account.details_submitted
          ? 'Stripe Connect account active'
          : 'Finish onboarding to enable payouts',
      };
    } catch (err) {
      this.logger.warn(
        `Connect status failed for ${creatorId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        creatorId,
        connected: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        message: 'Unable to load Connect account — restart onboarding',
      };
    }
  }

  async createOnboardingLink(creatorId: string, returnUrl: string) {
    if (!this.isEnabled()) {
      return { url: null, message: 'Stripe billing is not enabled' };
    }
    if (!returnUrl?.trim()) {
      throw new BadRequestException('returnUrl is required');
    }

    const user = await this.userRepository.findOne({ where: { id: creatorId } });
    if (!user) throw new NotFoundException('Creator not found');

    const stripe = this.client();
    let accountId = user.stripeConnectAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: { forgeUserId: creatorId },
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      user.stripeConnectAccountId = accountId;
      await this.userRepository.save(user);
    }

    const refreshUrl =
      this.configService.get<string>('billing.stripeConnectRefreshUrl') ||
      returnUrl;

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return { url: link.url, accountId, message: 'Complete onboarding at the provided URL' };
  }
}
