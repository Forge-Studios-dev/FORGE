import { randomUUID } from 'crypto';
import type { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';

/** CLS + Express: correlation id for logs, filters, and clients (`x-correlation-id`). */
export function forgeClsSetup(cls: ClsService, req: Request, res: Response): void {
  const headerId = req.headers['x-correlation-id'];
  const id = typeof headerId === 'string' && headerId.length > 0 ? headerId : randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  cls.set('correlationId', id);
}
