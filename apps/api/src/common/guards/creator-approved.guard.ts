import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { CreatorStatus, UserRole, User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { AUTH_USER_CLS_KEY, type AuthUserSnapshot } from '../cls/auth-cls.keys';

@Injectable()
export class CreatorApprovedGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const authUser = req.user;

    if (!authUser?.sub) throw new ForbiddenException('Creator access required');
    if (authUser.role === UserRole.ADMIN) return true;
    if (authUser.role !== UserRole.CREATOR) throw new ForbiddenException('Creator access required');

    const snapshot = this.cls.get<AuthUserSnapshot>(AUTH_USER_CLS_KEY);
    const user: User =
      snapshot && snapshot.id === authUser.sub
        ? (snapshot as User)
        : await this.usersService.findById(authUser.sub);

    if (!user.isVerified) {
      throw new ForbiddenException('Please verify your account before using creator features');
    }

    if (user.creatorStatus !== CreatorStatus.APPROVED) {
      throw new ForbiddenException(
        user.creatorStatus === CreatorStatus.REJECTED
          ? 'Creator request rejected'
          : 'Creator request pending approval',
      );
    }

    return true;
  }
}

