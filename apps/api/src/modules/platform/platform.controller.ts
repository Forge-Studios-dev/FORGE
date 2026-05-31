import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { parseFeatureFlags } from '@forge/shared-types';

@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly configService: ConfigService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Public platform config (feature flags, no secrets)' })
  getPublicConfig() {
    const raw = this.configService.get<string>('featureFlags') || '';
    const featureFlags = parseFeatureFlags(raw);
    const firebaseProjectId = this.configService.get<string>('firebase.projectId') || '';
    const smtpHost = this.configService.get<string>('mail.smtpHost') || '';
    const smtpUser = this.configService.get<string>('mail.smtpUser') || '';
    const smtpPass = this.configService.get<string>('mail.smtpPass') || '';
    return {
      featureFlags,
      apiVersion: 'v1',
      auth: {
        /** Identity is custom JWT + Postgres — not Firebase Authentication. */
        provider: 'custom' as const,
        emailPassword: true,
        googleOAuth: this.configService.get<boolean>('oauth.google.enabled') === true,
        mailConfigured: Boolean(smtpHost && smtpUser && smtpPass),
        emailVerification: 'link' as const,
        otpVerification: false,
      },
      firebase: {
        adminConfigured: Boolean(
          firebaseProjectId &&
            (this.configService.get<string>('firebase.serviceAccountJson') ||
              this.configService.get<boolean>('firebase.useApplicationDefault') ||
              (this.configService.get<string>('firebase.clientEmail') &&
                this.configService.get<string>('firebase.privateKey'))),
        ),
        fcmEnabled: this.configService.get<boolean>('firebase.fcmEnabled') === true,
        appCheckEnabled: this.configService.get<boolean>('firebase.appCheckEnabled') === true,
        /** FCM + App Check only — Firebase Auth is not used for login. */
        usesFirebaseAuth: false,
      },
    };
  }
}
