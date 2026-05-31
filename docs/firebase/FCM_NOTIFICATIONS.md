# FCM Notifications Architecture

## Scope

FCM delivers **offline/background push**. In-app notifications (Postgres + REST) and Socket.IO toasts remain unchanged.

## Data model

Table `device_tokens`:

| Column | Notes |
|--------|-------|
| user_id | FK users |
| platform | `web` \| `android` \| `ios` |
| fcm_token | unique |
| last_seen_at | updated on register |
| revoked_at | set on logout all devices |

## API

- `POST /api/v1/notifications/devices/register` — JWT required
- `DELETE /api/v1/notifications/devices` — revoke current token or all

## Dispatch flow

1. Domain event (`video.ready`, `stream.started`, etc.)
2. `PushDispatchService.enqueueForUser(userId, payload)`
3. BullMQ queue `push-dispatch`
4. Worker batches tokens (max 500) via `firebase-admin` `sendEachForMulticast`
5. Prune tokens on `messaging/registration-token-not-registered`

## Payload shape

```json
{
  "notification": { "title": "...", "body": "..." },
  "data": { "type": "video_ready", "videoId": "..." }
}
```

## Clients

- **Web:** `public/firebase-messaging-sw.js`, register after login
- **Flutter:** `firebase_messaging` + register on login

## Env (API)

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=   # PEM, use \n in env
FCM_ENABLED=true
```

## Preferences (future)

Add `notification_preferences` per user before scaling broadcast pushes.
