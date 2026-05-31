import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, permissionsForUser } from '../auth/permissions';
import { UsersService } from '../../modules/users/users.service';
import { User } from '../../modules/users/entities/user.entity';
import { AUTH_USER_CLS_KEY, type AuthUserSnapshot } from '../cls/auth-cls.keys';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const authUser = req.user;
    if (!authUser?.sub) throw new UnauthorizedException('Authentication required');

    const snapshot = this.cls.get<AuthUserSnapshot>(AUTH_USER_CLS_KEY);
    const user: User =
      snapshot && snapshot.id === authUser.sub
        ? (snapshot as User)
        : await this.usersService.findById(authUser.sub);
    const userPermissions = permissionsForUser(user);

    const ok = required.every((p) => userPermissions.includes(p));
    if (!ok) {
      const needsVerified = required.some(
        (p) => p === Permission.ENGAGE || p === Permission.USE_LIBRARY,
      );
      if (needsVerified && !user.isVerified) {
        throw new ForbiddenException({
          message: 'Verify your email to use this feature',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }
      if (user.isActive === false) {
        throw new ForbiddenException({
          message: 'This account has been disabled',
          code: 'ACCOUNT_DISABLED',
        });
      }
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

