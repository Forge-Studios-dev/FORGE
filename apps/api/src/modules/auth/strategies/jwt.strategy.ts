import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';
import { AUTH_USER_CLS_KEY, type AuthUserSnapshot } from '../../../common/cls/auth-cls.keys';
import { AuthUserCacheService } from '../auth-user-cache.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
    private readonly authUserCache: AuthUserCacheService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const cached = await this.authUserCache.get(payload.sub);
    if (cached) {
      if (cached.deletedAt) throw new UnauthorizedException('User no longer exists');
      if (cached.isActive === false) {
        throw new UnauthorizedException({
          message: 'This account has been disabled',
          code: 'ACCOUNT_DISABLED',
        });
      }
      this.applyClsSnapshot(cached);
      return {
        sub: cached.id,
        email: cached.email,
        role: cached.role,
        isVerified: cached.isVerified,
      };
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'role', 'creatorStatus', 'isVerified', 'isActive', 'deletedAt'],
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('User no longer exists');
    if (user.isActive === false) {
      throw new UnauthorizedException({
        message: 'This account has been disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }
    await this.authUserCache.set({
      id: user.id,
      email: user.email,
      role: user.role,
      creatorStatus: user.creatorStatus,
      isVerified: user.isVerified,
      isActive: user.isActive,
      deletedAt: null,
    });
    this.applyClsSnapshot(user);
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  }

  private applyClsSnapshot(
    user: Pick<User, 'id' | 'email' | 'role' | 'creatorStatus' | 'isVerified'>,
  ): void {
    const snapshot: AuthUserSnapshot = {
      id: user.id,
      email: user.email,
      role: user.role,
      creatorStatus: user.creatorStatus,
      isVerified: user.isVerified,
    };
    this.cls.set(AUTH_USER_CLS_KEY, snapshot);
  }
}
