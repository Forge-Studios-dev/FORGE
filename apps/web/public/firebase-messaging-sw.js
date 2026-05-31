/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

let messaging = null;

self.addEventListener('message', (event) => {
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
