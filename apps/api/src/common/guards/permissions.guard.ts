import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, permissionsForUser } from '../auth/permissions';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const authUser = req.user;
    if (!authUser?.sub) throw new ForbiddenException('Insufficient permissions');

    const user = await this.usersService.findById(authUser.sub);
    const userPermissions = permissionsForUser(user);

    const ok = required.every((p) => userPermissions.includes(p));
    if (!ok) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}

