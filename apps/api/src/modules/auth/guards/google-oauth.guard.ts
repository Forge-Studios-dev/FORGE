import { ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

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
}
