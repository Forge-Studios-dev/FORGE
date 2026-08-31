import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAccountLockoutService } from './auth-account-lockout.service';
import { AuthEmailOtpService } from './auth-email-otp.service';
import { AuthMfaService } from './auth-mfa.service';
import { AuthOAuthExchangeService } from './auth-oauth-exchange.service';
import { AuthUserCacheService } from './auth-user-cache.service';
import { AuthSessionCacheService } from './auth-session-cache.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { GoogleStrategy } from './strategies/google.strategy';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({}),
    // Analytics→Communities and Referral→Gamification→Communities both cycle
    // back into Auth via Users; delay resolution until the graph is loaded.
    forwardRef(() => AnalyticsModule),
    NotificationsModule,
    forwardRef(() => ReferralModule),
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken, OAuthAccount]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthAccountLockoutService,
    AuthEmailOtpService,
    AuthMfaService,
    AuthOAuthExchangeService,
    AuthUserCacheService,
    AuthSessionCacheService,
    JwtStrategy,
    GoogleStrategy,
  ],
  exports: [AuthService, AuthUserCacheService, AuthSessionCacheService],
})
export class AuthModule {}
