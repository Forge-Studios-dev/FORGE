import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FirebaseService } from './firebase.service';
import { APP_CHECK_KEY } from './app-check.decorator';

export const APP_CHECK_HEADER = 'x-firebase-appcheck';

@Injectable()
export class AppCheckGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(APP_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    if (!this.configService.get<boolean>('firebase.appCheckEnabled')) return true;

    if (!this.firebase.isFirebaseAdminReady()) {
      throw new ForbiddenException(
        'App Check is enabled but Firebase Admin is not configured',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = req.headers[APP_CHECK_HEADER];
    const raw = typeof token === 'string' ? token : Array.isArray(token) ? token[0] : '';
    if (!raw) {
      throw new ForbiddenException('App Check token required');
    }
    const ok = await this.firebase.verifyAppCheckToken(raw);
    if (!ok) {
      throw new ForbiddenException('Invalid App Check token');
    }
    return true;
  }
}
