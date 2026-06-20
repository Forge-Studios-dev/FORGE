import { SetMetadata } from '@nestjs/common';
import { CommunityRoleType } from '../entities/community-role.entity';

export const COMMUNITY_ROLES_KEY = 'community_roles';

export const CommunityRoles = (...roles: CommunityRoleType[]) =>
  SetMetadata(COMMUNITY_ROLES_KEY, roles);
