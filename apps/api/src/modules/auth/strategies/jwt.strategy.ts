import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../users/entities/user.entity';
import { AUTH_USER_CLS_KEY, type AuthUserSnapshot } from '../../../common/cls/auth-cls.keys';

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
    const snapshot: AuthUserSnapshot = {
      id: user.id,
      email: user.email,
      role: user.role,
      creatorStatus: user.creatorStatus,
      isVerified: user.isVerified,
    };
    this.cls.set(AUTH_USER_CLS_KEY, snapshot);
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  }
}
