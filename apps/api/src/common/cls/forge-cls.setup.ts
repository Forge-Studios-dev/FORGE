import { randomUUID } from 'crypto';
import type { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';

/** Parse W3C traceparent (`00-{trace}-{span}-{flags}`) → trace id for log correlation. */
export function traceIdFromTraceparent(header: string | undefined): string | null {
  if (!header || typeof header !== 'string') return null;
  const parts = header.trim().split('-');
  if (parts.length < 4 || parts[0] !== '00') return null;
  const traceId = parts[1];
  return traceId.length === 32 ? traceId : null;
}

/** CLS + Express: correlation id for logs, filters, and clients (`x-correlation-id`). */
export function forgeClsSetup(cls: ClsService, req: Request, res: Response): void {
  const headerId = req.headers['x-correlation-id'];
  const id = typeof headerId === 'string' && headerId.length > 0 ? headerId : randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  cls.set('correlationId', id);

  const traceparent = req.headers['traceparent'];
  const traceId = traceIdFromTraceparent(
    typeof traceparent === 'string' ? traceparent : undefined,
  );
  if (traceId) {
    cls.set('traceId', traceId);
    (req as Request & { traceId?: string }).traceId = traceId;
  }
}
