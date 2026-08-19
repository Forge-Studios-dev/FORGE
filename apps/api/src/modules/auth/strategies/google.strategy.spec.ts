import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport-google-oauth20';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(() => {
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    strategy = new GoogleStrategy(configService);
  });

  const baseProfile = (overrides: Partial<{ email: string; verified: boolean }> = {}) =>
    ({
      id: 'google-1',
      displayName: 'A User',
      emails: [{ value: overrides.email ?? 'a@example.com', verified: overrides.verified ?? true }],
    }) as unknown as Profile;

  it('accepts a verified Google email', (done) => {
    strategy.validate('at', 'rt', baseProfile({ verified: true }), (err, payload) => {
      expect(err).toBeNull();
      expect(payload).toMatchObject({ providerId: 'google-1', email: 'a@example.com' });
      done();
    });
  });

  it('rejects an explicitly unverified Google email — trusting it would let an attacker claim a mailbox they do not control and take over the matching FORGE account', (done) => {
    strategy.validate('at', 'rt', baseProfile({ verified: false }), (err, payload) => {
      expect(err).toBeInstanceOf(Error);
      expect(payload).toBeUndefined();
      done();
    });
  });

  it('rejects a profile with no email at all', (done) => {
    const profile = { id: 'google-2', displayName: 'B User', emails: [] } as unknown as Profile;
    strategy.validate('at', 'rt', profile, (err, payload) => {
      expect(err).toBeInstanceOf(Error);
      expect(payload).toBeUndefined();
      done();
    });
  });
});
