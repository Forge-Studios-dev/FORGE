import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_FULL_KEY } from '../decorators/admin-full.decorator';
import { AdminTier, UserRole } from '../../modules/users/entities/user.entity';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

@Injectable()
export class AdminFullGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresFull = this.reflector.getAllAndOverride<boolean>(ADMIN_FULL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresFull) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (user.adminTier === AdminTier.MODERATOR) {
      throw new ForbiddenException({
        message: 'This action requires a full platform admin',
        code: 'ADMIN_TIER_MODERATOR',
      });
    }
    return true;
  }
}
