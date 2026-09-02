import { isSkillEconomyLmsEnabled } from './skill-economy-lms';

/**
 * Granular skill-platform feature flags (re-audit 2026-09).
 * FEATURES_SKILL_ECONOMY_LMS=true enables ALL skill modules (legacy compat).
 * Individual flags allow selective re-enable without full LMS surface.
 */

function envTrue(key: string): boolean {
  return process.env[key] === 'true';
}

/** Video-lesson courses (catalog, enroll, progress). Not quizzes/cohorts unless LMS flag on. */
export function isCoursesEnabled(): boolean {
  return envTrue('FEATURES_COURSES') || isSkillEconomyLmsEnabled();
}

/** Community-scoped mentorship matching. */
export function isMentorshipEnabled(): boolean {
  return envTrue('FEATURES_MENTORSHIP') || isSkillEconomyLmsEnabled();
}

/** Twitch-style channel points. */
export function isChannelPointsEnabled(): boolean {
  return envTrue('FEATURES_CHANNEL_POINTS') || isSkillEconomyLmsEnabled();
}

/**
 * Full LMS extension: articles, podcasts, study groups, Q&A, quizzes, cohorts, programs.
 * Default off; only FEATURES_SKILL_ECONOMY_LMS enables.
 */
export function isSkillEconomyLmsExtendedEnabled(): boolean {
  return isSkillEconomyLmsEnabled();
}
