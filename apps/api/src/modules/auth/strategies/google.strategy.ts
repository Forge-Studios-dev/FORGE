import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfilePayload = {
  providerId: string;
  email: string;
  displayName: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const enabled = configService.get<boolean>('oauth.google.enabled');
    const clientID = configService.get<string>('oauth.google.clientId') || 'disabled';
    const clientSecret = configService.get<string>('oauth.google.clientSecret') || 'disabled';
    const callbackURL =
      configService.get<string>('oauth.google.callbackUrl') ||
      'http://localhost:3001/api/v1/auth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
    if (!enabled) {
      // Strategy still registered; routes check enabled flag before redirect
    }
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account has no email'), undefined);
      return;
    }
    const payload: GoogleProfilePayload = {
      providerId: profile.id,
      email: email.trim().toLowerCase(),
      displayName: profile.displayName || email.split('@')[0] || 'User',
    };
    done(null, payload);
  }
}
