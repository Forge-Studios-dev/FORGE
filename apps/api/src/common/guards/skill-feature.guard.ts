import {
  CanActivate,
  ExecutionContext,
  GoneException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  isChannelPointsEnabled,
  isCoursesEnabled,
  isMentorshipEnabled,
  isSkillEconomyLmsExtendedEnabled,
} from '../features/skill-platform';

export type SkillFeatureFlag =
  | 'courses'
  | 'mentorship'
  | 'channelPoints'
  | 'skillEconomyLms';

export const SKILL_FEATURE_KEY = 'skillFeature';

export const RequireSkillFeature = (feature: SkillFeatureFlag) =>
  SetMetadata(SKILL_FEATURE_KEY, feature);

function isFeatureEnabled(feature: SkillFeatureFlag): boolean {
  switch (feature) {
    case 'courses':
      return isCoursesEnabled();
    case 'mentorship':
      return isMentorshipEnabled();
    case 'channelPoints':
      return isChannelPointsEnabled();
    case 'skillEconomyLms':
      return isSkillEconomyLmsExtendedEnabled();
    default:
      return false;
  }
}

/**
 * Per-feature guard replacing monolithic SkillEconomyLmsGuard where granular flags apply.
 * Use @RequireSkillFeature('courses') on controller or route.
 */
@Injectable()
export class SkillFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature =
      this.reflector.getAllAndOverride<SkillFeatureFlag>(SKILL_FEATURE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'skillEconomyLms';

    if (isFeatureEnabled(feature)) {
      return true;
    }

    throw new GoneException({
      message:
        'This skill-platform feature is disabled on this FORGE deployment.',
      code: 'SKILL_FEATURE_DISABLED',
      feature,
    });
  }
}
