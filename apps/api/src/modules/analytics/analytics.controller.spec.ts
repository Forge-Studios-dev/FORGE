import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AnalyticsController } from './analytics.controller';
import { CommunityRoleGuard } from '../communities/guards/community-role.guard';
import { COMMUNITY_ROLES_KEY } from '../communities/decorators/community-roles.decorator';
import { CommunityRoleType } from '../communities/entities/community-role.entity';

describe('AnalyticsController security', () => {
  const communityScopedHandlers = [
    'communityChurn',
    'communityChurnPrediction',
    'communityPredictions',
  ] as const;

  it.each(communityScopedHandlers)(
    '%s requires CommunityRoleGuard + an owner/admin/coach community role — not just any authenticated user',
    (handlerName) => {
      const handler = (AnalyticsController.prototype as unknown as Record<string, () => unknown>)[
        handlerName
      ];
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;
      expect(guards).toContain(CommunityRoleGuard);

      const roles = Reflect.getMetadata(COMMUNITY_ROLES_KEY, handler) as
        | CommunityRoleType[]
        | undefined;
      expect(roles).toEqual(
        expect.arrayContaining([
          CommunityRoleType.OWNER,
          CommunityRoleType.ADMIN,
          CommunityRoleType.COACH,
        ]),
      );
    },
  );
});
