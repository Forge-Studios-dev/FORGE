import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

/**
 * Validates JWT when Authorization Bearer is present; otherwise continues without user.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | undefined {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return undefined;
    }
    if (err || !user) {
      throw err instanceof Error ? err : new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
