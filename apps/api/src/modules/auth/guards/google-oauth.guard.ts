import { ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.configService.get<boolean>('oauth.google.enabled')) {
      throw new NotFoundException('Google sign-in is not enabled');
    }
    return super.canActivate(context);
  }

  // Google echoes `state` back verbatim on the callback — used only as a
  // platform hint (see googleCallback), not for passport's session-based
  // CSRF check, so no `state: true` on the strategy itself is needed.
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    return req.query?.platform === 'mobile' ? { state: 'mobile' } : undefined;
  }
}
