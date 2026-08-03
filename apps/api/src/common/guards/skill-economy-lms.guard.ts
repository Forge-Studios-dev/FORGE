import {
  CanActivate,
  GoneException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Courses / podcasts / creator programs are skill-economy LMS surfaces.
 * Controllers are omitted at boot when FEATURES_SKILL_ECONOMY_LMS is unset;
 * this guard is a second line if a controller is still mounted (e.g. tests).
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
        'Courses and podcasts are retired on this FORGE deployment. Use videos, Shorts, and playlists instead.',
      code: 'SKILL_ECONOMY_LMS_RETIRED',
    });
  }
}
