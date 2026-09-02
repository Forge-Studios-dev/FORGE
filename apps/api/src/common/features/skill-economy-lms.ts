/**
 * Full skill-economy LMS (articles, podcasts, study groups, Q&A, quizzes, cohorts, programs).
 * Default OFF. Opt in with FEATURES_SKILL_ECONOMY_LMS=true.
 * Selective modules use FEATURES_COURSES / FEATURES_MENTORSHIP / FEATURES_CHANNEL_POINTS — see skill-platform.ts.
 */
export function isSkillEconomyLmsEnabled(): boolean {
  return process.env.FEATURES_SKILL_ECONOMY_LMS === 'true';
}
