import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { CreatorStatus, UserRole } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class CreatorApprovedGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const authUser = req.user;

    if (!authUser?.sub) throw new ForbiddenException('Creator access required');
    if (authUser.role === UserRole.ADMIN) return true;
    if (authUser.role !== UserRole.CREATOR) throw new ForbiddenException('Creator access required');

    const user = await this.usersService.findById(authUser.sub);

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

