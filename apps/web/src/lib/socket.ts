import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let lastToken: string | null = null;

function socketBaseUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return api.replace(/\/api\/v1\/?$/, '');
}

export function getSocket(accessToken?: string | null): Socket | null {
  if (typeof window === 'undefined') return null;
  if (!accessToken) return null;

  if (!socket) {
    socket = io(`${socketBaseUrl()}/events`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: { token: accessToken },
    });
    lastToken = accessToken;
  } else {
    if (lastToken !== accessToken) {
      socket.auth = { ...(socket.auth as Record<string, unknown>), token: accessToken };
      lastToken = accessToken;
      if (socket.connected) {
        socket.disconnect();
        socket.connect();
      }
    } else if (!socket.connected) {
      socket.connect();
    }
  }

  return socket;
}

export function joinRoom(
  roomEvent: 'join-video' | 'join-stream' | 'join-live-feed' | 'join-conversation',
  payload: Record<string, unknown> = {},
) {
  return new Promise<void>((resolve) => {
    if (!socket) return resolve();
    socket.emit(roomEvent, payload, () => resolve());
    setTimeout(() => resolve(), 500);
  });
}

export function leaveRoom(
  roomEvent: 'leave-video' | 'leave-stream' | 'leave-conversation',
  payload: Record<string, unknown>,
) {
  if (!socket) return;
  socket.emit(roomEvent, payload);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    lastToken = null;
  }
}
