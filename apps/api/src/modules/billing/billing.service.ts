import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  ProviderWebhookResult,
} from './payment-provider.interface';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { SubscriptionTier } from '../entitlements/entities/subscription-tier.entity';
import {
  MemberSubscription,
  MemberSubscriptionSource,
  MemberSubscriptionStatus,
} from '../entitlements/entities/member-subscription.entity';
import { User } from '../users/entities/user.entity';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Injectable()
export class BillingService {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
    private readonly configService: ConfigService,
    private readonly entitlementsService: EntitlementsService,
    @InjectRepository(SubscriptionTier)
    private readonly tierRepository: Repository<SubscriptionTier>,
    @InjectRepository(MemberSubscription)
    private readonly subscriptionRepository: Repository<MemberSubscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  isStripeEnabled(): boolean {
    return this.configService.get<boolean>('stripe.enabled') === true;
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutDto) {
    if (!this.isStripeEnabled()) {
      throw new ForbiddenException(
        'Stripe billing is not enabled — use mock subscriptions in development',
      );
    }

    const tier = await this.tierRepository.findOne({ where: { id: dto.tierId } });
    if (!tier || !tier.isActive) throw new NotFoundException('Tier not found');
    if (tier.creatorId !== dto.creatorId) {
      throw new BadRequestException('Tier does not belong to creator');
    }
    if (!tier.stripePriceId) {
      throw new BadRequestException('Tier is not configured for Stripe checkout');
    }
    if (tier.priceCents <= 0) {
      throw new BadRequestException('Free tiers cannot use Stripe checkout');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';

    const result = await this.paymentProvider.createCheckoutSession({
      userId,
      creatorId: dto.creatorId,
      tierId: dto.tierId,
      successUrl: `${webUrl}/profile?checkout=success`,
      cancelUrl: `${webUrl}/profile?checkout=cancel`,
      stripePriceId: tier.stripePriceId,
      stripeCustomerId: user.stripeCustomerId ?? undefined,
      customerEmail: user.email,
    });

    return result;
  }

  async handleStripeWebhook(payload: Buffer, headers: Record<string, string>) {
    const result = this.paymentProvider.verifyWebhook(payload, headers);
    if (!result) {
      throw new BadRequestException('Invalid Stripe webhook');
    }
    if (!result.handled) return { ok: true };

    await this.applyWebhookResult(result);
    return { ok: true };
  }

  private async applyWebhookResult(result: ProviderWebhookResult): Promise<void> {
    if (result.action === 'activate' && result.userId && result.creatorId && result.tierId) {
      if (result.externalSubscriptionId) {
        const existing = await this.subscriptionRepository.findOne({
          where: {
            externalRef: result.externalSubscriptionId,
            status: MemberSubscriptionStatus.ACTIVE,
          },
        });
        if (existing) return;
      }

      if (result.stripeCustomerId) {
        await this.userRepository.update(result.userId, {
          stripeCustomerId: result.stripeCustomerId,
        });
      }

      await this.entitlementsService.grantSubscription(
        result.userId,
        {
          creatorId: result.creatorId,
          tierId: result.tierId,
          expiresInDays: result.currentPeriodEnd
            ? Math.max(
                1,
                Math.ceil(
                  (result.currentPeriodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
                ),
              )
            : undefined,
        },
        MemberSubscriptionSource.PAYMENT,
      );

      if (result.externalSubscriptionId) {
        const sub = await this.subscriptionRepository.findOne({
          where: {
            userId: result.userId,
            creatorId: result.creatorId,
            status: MemberSubscriptionStatus.ACTIVE,
          },
          order: { createdAt: 'DESC' },
        });
        if (sub) {
          await this.subscriptionRepository.update(sub.id, {
            externalRef: result.externalSubscriptionId,
          });
        }
      }
      return;
    }

    if (
      (result.action === 'cancel' || result.status === 'canceled' || result.status === 'expired') &&
      result.externalSubscriptionId
    ) {
      const existing = await this.subscriptionRepository.findOne({
        where: { externalRef: result.externalSubscriptionId },
      });
      if (!existing || existing.status === MemberSubscriptionStatus.CANCELED) return;

      await this.subscriptionRepository.update(
        { externalRef: result.externalSubscriptionId },
        { status: MemberSubscriptionStatus.CANCELED },
      );
      if (result.userId && result.creatorId) {
        await this.entitlementsService.bustSubscriptionCacheForUser(
          result.userId,
          result.creatorId,
        );
      }
    }
  }

  async cancelMySubscription(userId: string, creatorId: string) {
    const sub = await this.subscriptionRepository.findOne({
      where: {
        userId,
        creatorId,
        status: MemberSubscriptionStatus.ACTIVE,
        source: MemberSubscriptionSource.PAYMENT,
      },
      order: { createdAt: 'DESC' },
    });
    if (!sub) throw new NotFoundException('No active paid subscription found');
    if (!sub.externalRef) {
      throw new BadRequestException('Subscription has no external billing reference');
    }

    await this.paymentProvider.cancelSubscription(sub.externalRef);
    await this.subscriptionRepository.update(sub.id, {
      status: MemberSubscriptionStatus.CANCELED,
    });
    await this.entitlementsService.bustSubscriptionCacheForUser(userId, creatorId);
    return { ok: true };
  }
}
