/** CORS for Socket.IO — align with HTTP CORS in `main.ts` (production uses WEB_URL / ADMIN_URL). */
export function socketIoCorsOptions(): { origin: string | string[] | boolean; credentials: boolean } {
  const production = process.env.NODE_ENV === 'production';
  if (production) {
    const list = [process.env.WEB_URL || '', process.env.ADMIN_URL || ''].filter(Boolean);
    return { origin: list.length ? list : false, credentials: true };
  }
  return { origin: true, credentials: true };
}
