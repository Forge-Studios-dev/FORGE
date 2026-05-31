/**
 * Public GET /platform/config payload (no secrets).
 * Keep in sync with apps/api/src/modules/platform/platform.controller.ts
 */

export type PlatformAuthConfig = {
  provider: 'custom';
  emailPassword: boolean;
  googleOAuth: boolean;
  /** True when API SMTP is configured (verification/reset emails can send). */
  mailConfigured: boolean;
  emailVerification: 'link' | 'link_or_otp';
  otpVerification: boolean;
};

export type PlatformFirebaseConfig = {
  adminConfigured: boolean;
  fcmEnabled: boolean;
  appCheckEnabled: boolean;
  usesFirebaseAuth: boolean;
};

export type PlatformPublicConfig = {
  featureFlags: string[];
  apiVersion: string;
  auth?: PlatformAuthConfig;
  firebase?: PlatformFirebaseConfig;
};

/** True when API reports custom JWT identity (not Firebase Auth). */
export function isCustomAuthProvider(config: PlatformPublicConfig): boolean {
  return config.auth?.provider === 'custom';
}

/** True when Firebase is complement-only (FCM/App Check), not login IdP. */
export function isFirebaseComplementOnly(config: PlatformPublicConfig): boolean {
  return config.firebase?.usesFirebaseAuth === false;
}

export function isMailConfigured(config: PlatformPublicConfig): boolean {
  return config.auth?.mailConfigured === true;
}
