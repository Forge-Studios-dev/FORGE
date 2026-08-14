import {
  CanActivate,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Skill-economy LMS surfaces (courses, podcasts, mentorship, brands, bundles, XP).
 * Controllers may be omitted at boot when FEATURES_SKILL_ECONOMY_LMS is unset;
 * this guard is a second line when a controller is still mounted.
 */
@Injectable()
export class SkillEconomyLmsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (this.configService.get<boolean>('features.skillEconomyLms') === true) {
      return true;
    }
    throw new GoneException({
      message:
        'This skill-economy feature is retired on this FORGE deployment. Use videos, Shorts, playlists, and channel memberships instead.',
      code: 'SKILL_ECONOMY_LMS_RETIRED',
    });
  }
}
