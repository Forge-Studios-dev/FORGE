import {
  isChannelPointsEnabled,
  isCoursesEnabled,
  isMentorshipEnabled,
  isSkillEconomyLmsExtendedEnabled,
} from './skill-platform';

describe('skill-platform feature flags', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.FEATURES_SKILL_ECONOMY_LMS;
    delete process.env.FEATURES_COURSES;
    delete process.env.FEATURES_MENTORSHIP;
    delete process.env.FEATURES_CHANNEL_POINTS;
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults all selective flags to false', () => {
    expect(isCoursesEnabled()).toBe(false);
    expect(isMentorshipEnabled()).toBe(false);
    expect(isChannelPointsEnabled()).toBe(false);
    expect(isSkillEconomyLmsExtendedEnabled()).toBe(false);
  });

  it('FEATURES_COURSES enables courses only', () => {
    process.env.FEATURES_COURSES = 'true';
    expect(isCoursesEnabled()).toBe(true);
    expect(isMentorshipEnabled()).toBe(false);
  });

  it('FEATURES_SKILL_ECONOMY_LMS enables all', () => {
    process.env.FEATURES_SKILL_ECONOMY_LMS = 'true';
    expect(isCoursesEnabled()).toBe(true);
    expect(isMentorshipEnabled()).toBe(true);
    expect(isChannelPointsEnabled()).toBe(true);
    expect(isSkillEconomyLmsExtendedEnabled()).toBe(true);
  });
});
