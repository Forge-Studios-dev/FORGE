import type { AppCheck } from 'firebase/app-check';

let appCheckInstance: AppCheck | null = null;

export async function getAppCheckToken(): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return null;
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const {
      initializeAppCheck,
      ReCaptchaEnterpriseProvider,
      getToken: fetchAppCheckToken,
    } = await import('firebase/app-check');
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey || !config.projectId) return null;
    const app = getApps().length ? getApps()[0]! : initializeApp(config);
    if (!appCheckInstance) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    const result = await fetchAppCheckToken(appCheckInstance);
    return result.token;
  } catch {
    return null;
  }
}
