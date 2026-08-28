import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user) throw new ForbiddenException('Insufficient permissions');
    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Admin capability (ban users, delete content, grant paid memberships,
    // etc.) is otherwise protected by nothing stronger than a normal user
    // password. Require MFA on the account before any admin-only route is
    // reachable -- enrollment itself only needs a plain authenticated
    // session (/auth/mfa/enroll, /mfa/verify), so this can't lock an admin
    // out of setting it up.
    if (requiredRoles.includes(UserRole.ADMIN) && user.role === UserRole.ADMIN && !user.mfaEnabled) {
      throw new ForbiddenException({
        message: 'Enable multi-factor authentication before using admin features',
        code: 'ADMIN_MFA_REQUIRED',
      });
    }

    return true;
  }
}
