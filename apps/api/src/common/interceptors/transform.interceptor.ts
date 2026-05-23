import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  correlationId?: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    // Prometheus scrapers require raw text/plain exposition, not { success, data } JSON.
    if (req.path === '/metrics' || req.url?.startsWith('/metrics')) {
      return next.handle();
    }
    const correlationId = req.correlationId;
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        correlationId,
      })),
    );
  }
}
