import { api } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';

let registrationStarted = false;

export async function registerFcmTokenIfPossible() {
  if (registrationStarted || typeof window === 'undefined') return;
  if (!getAccessToken()) return;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!vapidKey || !apiKey) return;

  registrationStarted = true;
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return;

    const config = {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    const app = getApps().length ? getApps()[0]! : initializeApp(config);
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    swReg.active?.postMessage({ type: 'FIREBASE_CONFIG', config });
    await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return;

    await api.post('/notifications/devices/register', {
      platform: 'web',
      fcmToken: token,
    });
  } catch {
    registrationStarted = false;
  }
}
