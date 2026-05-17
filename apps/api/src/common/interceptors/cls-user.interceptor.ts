import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';

/** After JWT guard, mirror `req.user.sub` into CLS for logging and services. */
@Injectable()
export class ClsUserInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
      const sub = req.user?.sub;
      if (sub) this.cls.set('userId', sub);
    }
    return next.handle();
  }
}
