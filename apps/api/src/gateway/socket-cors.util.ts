/** CORS for Socket.IO — align with HTTP CORS in `main.ts`. */
import { productionCorsOrigins } from '../config/cors-origins';

export function socketIoCorsOptions(): { origin: string | string[] | boolean; credentials: boolean } {
  const production = process.env.NODE_ENV === 'production';
  if (production) {
    const list = productionCorsOrigins();
    return { origin: list.length ? list : false, credentials: true };
  }
  return { origin: true, credentials: true };
}
