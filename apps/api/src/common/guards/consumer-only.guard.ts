import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user.entity';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Platform admins may only use /admin/* and shared auth/health routes.
 * Blocks admin JWTs from consumer APIs (feed, upload, profile, etc.).
 */
@Injectable()
export class ConsumerOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.includes(UserRole.ADMIN)) return true;

    const controllerName = context.getClass().name;
    if (controllerName === 'AuthController' || controllerName === 'HealthController') {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) return true;

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Platform admin accounts must use the admin application and /admin API routes only',
      );
    }
    return true;
  }
}
