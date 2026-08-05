import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, ClientSessionMeta } from './auth.service';
import {
  clearAccessTokenCookie,
  clearAdminAuthCookies,
  clearRefreshTokenCookie,
  clearSessionCookie,
  assertCookieRefreshCsrf,
  readRefreshTokenFromRequest,
  setAccessTokenCookie,
  setAdminAuthCookies,
  setRefreshTokenCookie,
  setSessionCookie,
} from './auth-cookies';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { GoogleProfilePayload } from './strategies/google.strategy';
import { AppCheckGuard } from '../firebase/app-check.guard';
import { RequireAppCheck } from '../firebase/app-check.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { ConsumeImpersonationDto } from './dto/consume-impersonation.dto';
import { AuthOAuthExchangeService } from './auth-oauth-exchange.service';
import { LogoutDto } from './dto/logout.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';

function sessionMeta(req: Request): ClientSessionMeta {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : req.ip || req.socket.remoteAddress || null;
  return {
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    ip: ip || null,
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly oauthExchangeService: AuthOAuthExchangeService,
  ) {}

  private applyAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    role?: string,
  ) {
    setRefreshTokenCookie(res, refreshToken, this.configService);
    setSessionCookie(res, this.configService);
    setAccessTokenCookie(res, accessToken, this.configService);
    // Admin app reads its own cookie names (forge_admin_token/forge_admin_session);
    // only issue them for an actual admin-role login, mirroring the prior
    // client-side behavior without ever handing a non-admin an admin-shaped cookie.
    if (role === 'admin') {
      setAdminAuthCookies(res, accessToken, this.configService);
    }
  }

  @Public()
  @UseGuards(AppCheckGuard)
  @RequireAppCheck()
  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register a new user' })
  async signup(@Body() dto: SignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.signup(dto, sessionMeta(req));
    this.applyAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.user?.role);
    return tokens;
  }

  @Public()
  @UseGuards(AppCheckGuard)
  @RequireAppCheck()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto, sessionMeta(req));
    this.applyAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.user?.role);
    return tokens;
  }

  @Public()
  @Get('google')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth' })
  googleAuth() {
    return;
  }

  @Public()
  @Get('google/callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Req() req: Request & { user: GoogleProfilePayload },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.loginWithGoogle(req.user, sessionMeta(req));
    this.applyAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.user?.role);
    const code = await this.oauthExchangeService.createExchangeCode(
      this.oauthExchangeService.payloadFromTokens({
        accessToken: tokens.accessToken,
        sessionId: tokens.sessionId,
        user: tokens.user,
      }),
    );
    const successUrl = this.configService.get<string>('oauth.google.webSuccessUrl')!;
    const url = new URL(successUrl);
    url.searchParams.set('code', code);
    return res.redirect(url.toString());
  }

  @Public()
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange one-time OAuth code for session tokens' })
  async oauthExchange(@Body() dto: OAuthExchangeDto) {
    return this.oauthExchangeService.consumeExchangeCode(dto.code);
  }

  @Public()
  @Post('impersonate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange admin impersonation token for a user session' })
  async impersonate(
    @Body() dto: ConsumeImpersonationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.consumeImpersonationToken(dto.token, sessionMeta(req));
    this.applyAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.user?.role);
    return tokens;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Refresh access token using opaque refresh token (body or HttpOnly cookie)' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    assertCookieRefreshCsrf(req, this.configService, dto.refreshToken);
    const raw = readRefreshTokenFromRequest(req, dto.refreshToken);
    if (!raw) {
      throw new UnauthorizedException('Refresh token required');
    }
    const tokens = await this.authService.refreshWithToken(raw, sessionMeta(req));
    this.applyAuthCookies(res, tokens.accessToken, tokens.refreshToken, tokens.user?.role);
    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — current device by default; pass allDevices to sign out everywhere' })
  async logout(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Cookie sessions always require double-submit CSRF (including allDevices).
    assertCookieRefreshCsrf(req, this.configService);
    if (body?.allDevices) {
      await this.authService.logoutAll(user.sub);
      await this.notificationsService.revokeDevice(user.sub);
    } else {
      const raw = readRefreshTokenFromRequest(req);
      await this.authService.logoutCurrent(user.sub, raw);
    }
    clearRefreshTokenCookie(res, this.configService);
    clearSessionCookie(res, this.configService);
    clearAccessTokenCookie(res, this.configService);
    // Harmless no-op if this session never had admin cookies set.
    clearAdminAuthCookies(res, this.configService);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List active refresh-token sessions for this account' })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.listSessions(user.sub);
  }

  @Get('login-history')
  @ApiOperation({ summary: 'Recent sign-ins (device sessions with login timestamps)' })
  loginHistory(@CurrentUser() user: JwtPayload) {
    return this.authService.listLoginHistory(user.sub);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a single session' })
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.authService.revokeSession(user.sub, id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Request password reset email (always 204)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete password reset with token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Change password while signed in (revokes other sessions)' })
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
      user.sid,
    );
  }

  @Post('verify-email/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Resend email verification link' })
  async resendVerification(@CurrentUser() user: JwtPayload) {
    return this.authService.resendVerification(user.sub);
  }

  @Public()
  @Get('verify-email')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify email with token from link' })
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post('verify-email/otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify email with 6-digit code from verification email' })
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailWithOtp(dto.email, dto.code);
  }
}
