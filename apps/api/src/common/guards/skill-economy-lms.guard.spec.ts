import { GoneException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkillEconomyLmsGuard } from './skill-economy-lms.guard';

describe('SkillEconomyLmsGuard', () => {
  it('allows when FEATURES_SKILL_ECONOMY_LMS is enabled', () => {
    const guard = new SkillEconomyLmsGuard({
      get: (key: string) => (key === 'features.skillEconomyLms' ? true : undefined),
    } as ConfigService);
    expect(guard.canActivate()).toBe(true);
  });

  it('returns 410 Gone when LMS is retired', () => {
    const guard = new SkillEconomyLmsGuard({
      get: () => false,
    } as unknown as ConfigService);
    expect(() => guard.canActivate()).toThrow(GoneException);
  });
});
