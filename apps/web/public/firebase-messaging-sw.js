/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

let messaging = null;

/** Resolve a deep link from FCM `data` (mirrors apps/web/src/lib/notification-href.ts). */
function hrefFromPushData(data) {
  const d = data || {};
  const type = d.type;
  const videoId = d.videoId;
  const streamId = d.streamId;
  const videoType = d.videoType;
  // SW cannot read Next env — keep in sync with NEXT_PUBLIC_ADMIN_URL prod default.
  const adminBase = 'https://admin.forgestudios.net';

  if (type === 'content_scan_held') {
    // Uploader → Studio; admins → admin held queue (mirrors notification-href.ts).
    if (d.audience === 'uploader') {
      return videoId ? `/studio/videos/${videoId}` : '/studio/videos';
    }
    const q = new URLSearchParams({ moderationStatus: 'held' });
    if (videoId) q.set('videoId', videoId);
    return `${adminBase}/content?${q.toString()}`;
  }
  if (type === 'stream_started' || type === 'stream_started_followed' || type === 'stream_reminder') {
    return streamId ? `/live/${streamId}` : '/live';
  }
  if (type === 'comment_on_video' || type === 'comment_reply') {
    if (!videoId) return '/notifications';
    const commentId = d.commentId;
    return commentId
      ? `/watch/${videoId}?lc=${encodeURIComponent(commentId)}`
      : `/watch/${videoId}`;
  }
  if (
    type === 'video_ready' ||
    type === 'premium_content_new' ||
    type === 'video_liked' ||
    type === 'super_thanks'
  ) {
    if (!videoId) return '/notifications';
    return videoType === 'short' ? `/shorts?v=${videoId}` : `/watch/${videoId}`;
  }
  if (type === 'creator_approved') return '/studio';
  if (type === 'direct_message') return '/messages';
  if (videoId) {
    return videoType === 'short' ? `/shorts?v=${videoId}` : `/watch/${videoId}`;
  }
  return '/notifications';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = hrefFromPushData(event.notification.data);
  const absolute =
    href.startsWith('http://') || href.startsWith('https://')
      ? href
      : new URL(href, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(absolute);
          }
          return clients.openWindow(absolute);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(absolute);
      }
      return undefined;
    }),
  );
});

self.addEventListener('message', (event) => {
  // Only accept FIREBASE_CONFIG from same-origin pages (CodeQL: js/missing-origin-check).
  let messageOrigin = typeof event.origin === 'string' ? event.origin : '';
  if (!messageOrigin && event.source && typeof event.source.url === 'string') {
    try {
      messageOrigin = new URL(event.source.url).origin;
    } catch {
      return;
    }
  }
  if (messageOrigin !== self.location.origin) return;
  if (event.data?.type !== 'FIREBASE_CONFIG' || !event.data.config) return;
  if (!firebase.apps.length) {
    firebase.initializeApp(event.data.config);
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || 'FORGE';
      self.registration.showNotification(title, {
        body: payload.notification?.body,
        data: payload.data,
      });
    });
  }
});
