import {
  isCustomAuthProvider,
  isFirebaseComplementOnly,
  isMailConfigured,
  isMockSubscriptionsEnabled,
  isStripeBillingEnabled,
  type PlatformPublicConfig,
} from './platform-public-config';

const base: PlatformPublicConfig = {
  featureFlags: [],
  apiVersion: 'v1',
  auth: {
    provider: 'custom',
    emailPassword: true,
    googleOAuth: false,
    mailConfigured: true,
    emailVerification: 'link',
    otpVerification: false,
  },
  firebase: {
    adminConfigured: false,
    fcmEnabled: false,
    appCheckEnabled: false,
    usesFirebaseAuth: false,
  },
};

describe('platform-public-config', () => {
  it('detects custom auth provider', () => {
    expect(isCustomAuthProvider(base)).toBe(true);
    expect(isCustomAuthProvider({ featureFlags: [], apiVersion: 'v1' })).toBe(false);
  });

  it('detects Firebase complement-only', () => {
    expect(isFirebaseComplementOnly(base)).toBe(true);
    expect(
      isFirebaseComplementOnly({
        ...base,
        firebase: { ...base.firebase!, usesFirebaseAuth: true },
      }),
    ).toBe(false);
  });

  it('detects mail configured', () => {
    expect(isMailConfigured(base)).toBe(true);
    expect(
      isMailConfigured({
        ...base,
        auth: { ...base.auth!, mailConfigured: false },
      }),
    ).toBe(false);
  });

  it('detects Stripe billing enabled', () => {
    expect(isStripeBillingEnabled({ ...base, billing: { stripeEnabled: true, mockSubscriptionsEnabled: true } })).toBe(true);
    expect(isStripeBillingEnabled(base)).toBe(false);
  });

  it('detects mock subscriptions enabled by default', () => {
    expect(isMockSubscriptionsEnabled(base)).toBe(true);
    expect(
      isMockSubscriptionsEnabled({
        ...base,
        billing: { stripeEnabled: false, mockSubscriptionsEnabled: false },
      }),
    ).toBe(false);
  });
});
