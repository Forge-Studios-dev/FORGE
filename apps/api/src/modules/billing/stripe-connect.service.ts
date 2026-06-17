import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Stripe Connect onboarding — deferred full implementation (F-1101 remainder). */
@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    const provider = (this.configService.get<string>('billing.provider') || 'stub').toLowerCase();
    return provider === 'stripe' && !!this.configService.get<string>('billing.stripeSecretKey');
  }

  async getConnectStatus(creatorId: string) {
    return {
      creatorId,
      connected: false,
      payoutsEnabled: false,
      message: 'Stripe Connect onboarding coming soon — contact platform admin for early access',
    };
  }

  async createOnboardingLink(creatorId: string, returnUrl: string) {
    if (!this.isEnabled()) {
      return { url: null, message: 'Stripe billing is not enabled' };
    }
    this.logger.debug(`Connect onboarding requested for ${creatorId} return=${returnUrl}`);
    return { url: null, message: 'Connect onboarding not yet configured' };
  }
}
