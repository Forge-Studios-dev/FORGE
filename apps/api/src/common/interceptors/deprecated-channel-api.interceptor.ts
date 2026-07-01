import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DEPRECATED_CHANNEL_API_KEY } from '../decorators/deprecated-channel-api.decorator';
import {
  CHANNELS_API_SUNSET,
  CHANNELS_MIGRATION_HINT,
} from '../../modules/communities/community-deprecation.constants';

@Injectable()
export class DeprecatedChannelApiInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isDeprecated = this.reflector.getAllAndOverride<boolean>(DEPRECATED_CHANNEL_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isDeprecated) {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', CHANNELS_API_SUNSET);
    res.setHeader('Link', '</docs/COMMUNITY-PERMISSION-MATRIX.md>; rel="deprecation"');
    res.setHeader('X-Forge-Deprecated-Api', 'community-channels');
    res.setHeader('X-Forge-Migration-Hint', CHANNELS_MIGRATION_HINT);

    return next.handle().pipe(
      tap(() => {
        // Headers set before handler runs; tap ensures they persist on success path.
      }),
    );
  }
}
