/** Firebase App Check for admin login (parity with web). */
export async function getAppCheckToken(): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_APP_CHECK_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return null;

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { initializeAppCheck, ReCaptchaV3Provider, getToken } = await import('firebase/app-check');

    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      });

    const appCheck =
      (app as { _appCheck?: ReturnType<typeof initializeAppCheck> })._appCheck ??
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });

    const result = await getToken(appCheck, false);
    return result.token;
  } catch {
    return null;
  }
}
