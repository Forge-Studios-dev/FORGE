import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { StripeConnectService } from './stripe-connect.service';

const accountsCreate = jest.fn();
const accountsRetrieve = jest.fn();
const accountLinksCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    accounts: { create: accountsCreate, retrieve: accountsRetrieve },
    accountLinks: { create: accountLinksCreate },
  })),
);

describe('StripeConnectService', () => {
  let service: StripeConnectService;
  let configGet: jest.Mock;
  let userRepo: jest.Mocked<Pick<Repository<User>, 'findOne' | 'save'>>;

  const baseUser = (): User =>
    ({
      id: 'creator-1',
      email: 'creator@forge.local',
      stripeConnectAccountId: null,
    }) as unknown as User;

  async function createService(
    config: Record<string, unknown> = {
      'billing.provider': 'stripe',
      'billing.stripeSecretKey': 'sk_test',
    },
  ) {
    configGet = jest.fn((key: string) => config[key]);
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeConnectService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    return module.get(StripeConnectService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await createService();
  });

  describe('isEnabled', () => {
    it('is enabled when provider is stripe and key present', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('is disabled for stub provider', async () => {
      service = await createService({
        'billing.provider': 'stub',
        'billing.stripeSecretKey': 'sk_test',
      });
      expect(service.isEnabled()).toBe(false);
    });

    it('is disabled when secret key missing', async () => {
      service = await createService({ 'billing.provider': 'stripe' });
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('getConnectStatus', () => {
    it('returns disabled status when billing not enabled', async () => {
      service = await createService({ 'billing.provider': 'stub' });
      const status = await service.getConnectStatus('creator-1');
      expect(status.connected).toBe(false);
      expect(status.payoutsEnabled).toBe(false);
      expect(status.message).toContain('not enabled');
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });

    it('prompts onboarding when no connect account linked', async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser() });
      const status = await service.getConnectStatus('creator-1');
      expect(status.connected).toBe(false);
      expect(status.message).toContain('onboarding');
      expect(accountsRetrieve).not.toHaveBeenCalled();
    });

    it('returns active account details when onboarding complete', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_123',
      });
      accountsRetrieve.mockResolvedValue({
        payouts_enabled: true,
        charges_enabled: true,
        details_submitted: true,
      });
      const status = await service.getConnectStatus('creator-1');
      expect(status.connected).toBe(true);
      expect(status.accountId).toBe('acct_123');
      expect(status.payoutsEnabled).toBe(true);
      expect(status.chargesEnabled).toBe(true);
      expect(status.message).toContain('active');
    });

    it('signals incomplete onboarding when details not submitted', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_123',
      });
      accountsRetrieve.mockResolvedValue({
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
      });
      const status = await service.getConnectStatus('creator-1');
      expect(status.connected).toBe(true);
      expect(status.payoutsEnabled).toBe(false);
      expect(status.message).toContain('Finish onboarding');
    });

    it('degrades gracefully when Stripe retrieve throws', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_broken',
      });
      accountsRetrieve.mockRejectedValue(new Error('account deleted'));
      const status = await service.getConnectStatus('creator-1');
      expect(status.connected).toBe(false);
      expect(status.message).toContain('restart onboarding');
    });
  });

  describe('createOnboardingLink', () => {
    it('returns null url when billing disabled', async () => {
      service = await createService({ 'billing.provider': 'stub' });
      const result = await service.createOnboardingLink('creator-1', 'https://forge/return');
      expect(result.url).toBeNull();
      expect(accountsCreate).not.toHaveBeenCalled();
    });

    it('rejects empty returnUrl', async () => {
      await expect(service.createOnboardingLink('creator-1', '')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when creator not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOnboardingLink('creator-1', 'https://forge/return'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates and persists a new Connect account then returns link', async () => {
      userRepo.findOne.mockResolvedValue({ ...baseUser() });
      userRepo.save.mockImplementation(async (u) => u as User);
      accountsCreate.mockResolvedValue({ id: 'acct_new' });
      accountLinksCreate.mockResolvedValue({ url: 'https://stripe/onboard' });

      const result = await service.createOnboardingLink('creator-1', 'https://forge/return');

      expect(accountsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'express',
          email: 'creator@forge.local',
          metadata: { forgeUserId: 'creator-1' },
        }),
      );
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ stripeConnectAccountId: 'acct_new' }),
      );
      expect(result.accountId).toBe('acct_new');
      expect(result.url).toBe('https://stripe/onboard');
    });

    it('reuses an existing Connect account without recreating', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_existing',
      });
      accountLinksCreate.mockResolvedValue({ url: 'https://stripe/onboard' });

      const result = await service.createOnboardingLink('creator-1', 'https://forge/return');

      expect(accountsCreate).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(result.accountId).toBe('acct_existing');
    });

    it('prefers configured refresh url over return url for the account link', async () => {
      service = await createService({
        'billing.provider': 'stripe',
        'billing.stripeSecretKey': 'sk_test',
        'billing.stripeConnectRefreshUrl': 'https://forge/refresh',
      });
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_existing',
      });
      accountLinksCreate.mockResolvedValue({ url: 'https://stripe/onboard' });

      await service.createOnboardingLink('creator-1', 'https://forge/return');

      expect(accountLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          account: 'acct_existing',
          refresh_url: 'https://forge/refresh',
          return_url: 'https://forge/return',
          type: 'account_onboarding',
        }),
      );
    });

    it('falls back to returnUrl as refresh url when none configured', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser(),
        stripeConnectAccountId: 'acct_existing',
      });
      accountLinksCreate.mockResolvedValue({ url: 'https://stripe/onboard' });

      await service.createOnboardingLink('creator-1', 'https://forge/return');

      expect(accountLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh_url: 'https://forge/return',
          return_url: 'https://forge/return',
        }),
      );
    });
  });
});
