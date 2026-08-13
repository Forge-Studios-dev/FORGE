import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { AUTH_USER_CLS_KEY, type AuthUserSnapshot } from '../cls/auth-cls.keys';

/**
 * Blocks new uploads/live streams during an active 2-week upload
 * restriction from a 2nd strike (see AccountStrikesService) — mirrors
 * YouTube's own published Community Guidelines ladder. Stacks alongside
 * CreatorApprovedGuard; deliberately narrower — a restricted creator can
 * still use the rest of Studio, just not publish new content.
 */
@Injectable()
export class UploadNotRestrictedGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const authUser = req.user;
    if (!authUser?.sub) return true;
    if (authUser.role === UserRole.ADMIN) return true;

    const snapshot = this.cls.get<AuthUserSnapshot>(AUTH_USER_CLS_KEY);
    const user: User =
      snapshot && snapshot.id === authUser.sub
        ? (snapshot as User)
        : await this.usersService.findById(authUser.sub);

    if (user.uploadRestrictedUntil && user.uploadRestrictedUntil > new Date()) {
      throw new ForbiddenException(
        `Uploads and live streams are restricted until ${user.uploadRestrictedUntil.toISOString()} due to an account strike.`,
      );
    }

    return true;
  }
}
