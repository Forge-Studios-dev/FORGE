/**
 * Skill-economy LMS (courses / podcasts / programs).
 * Default OFF for YouTube-replica mode. Opt in with FEATURES_SKILL_ECONOMY_LMS=true.
 */
export function isSkillEconomyLmsEnabled(): boolean {
  return process.env.FEATURES_SKILL_ECONOMY_LMS === 'true';
}
