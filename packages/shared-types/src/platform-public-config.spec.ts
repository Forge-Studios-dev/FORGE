import {
  isCustomAuthProvider,
  isFirebaseComplementOnly,
  isMailConfigured,
  isCoursesFeatureEnabled,
  isSkillEconomyLmsEnabled,
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

  it('detects skill feature flags', () => {
    const withSkills: PlatformPublicConfig = {
      ...base,
      skillFeatures: {
        courses: true,
        mentorship: false,
        channelPoints: false,
        skillEconomyLms: true,
      },
    };
    expect(isCoursesFeatureEnabled(withSkills)).toBe(true);
    expect(isSkillEconomyLmsEnabled(withSkills)).toBe(true);
    expect(isSkillEconomyLmsEnabled(base)).toBe(false);
  });
});
