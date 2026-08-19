import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CommunityAiController } from './community-ai.controller';
import { CommunityRoleGuard } from './guards/community-role.guard';
import { COMMUNITY_ROLES_KEY } from './decorators/community-roles.decorator';
import { CommunityRoleType } from './entities/community-role.entity';

describe('CommunityAiController security', () => {
  it('summarizeRoom requires CommunityRoleGuard + an owner/admin/coach community role — not just any approved creator on the platform', () => {
    const handler = CommunityAiController.prototype.summarizeRoom;
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
  });
});
