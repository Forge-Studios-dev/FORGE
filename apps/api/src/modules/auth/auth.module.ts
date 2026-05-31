import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAccountLockoutService } from './auth-account-lockout.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { GoogleStrategy } from './strategies/google.strategy';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    AnalyticsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken, OAuthAccount]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthAccountLockoutService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
