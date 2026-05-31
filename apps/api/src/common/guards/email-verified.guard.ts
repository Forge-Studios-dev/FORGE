import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_VERIFIED_KEY } from '../decorators/require-verified.decorator';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';
import { User } from '../../modules/users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const userId = req.user?.sub;
    if (!userId) return true;

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isVerified'],
    });
    if (!user?.isVerified) {
      throw new ForbiddenException({
        message: 'Verify your email to continue',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    return true;
  }
}
