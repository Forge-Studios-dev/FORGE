import { CommunityRoleType } from './entities/community-role.entity';

export const COMMUNITY_PERMISSIONS = [
  'view_community',
  'post_in_community',
  'manage_posts',
  'manage_rooms',
  'manage_channels',
  'manage_events',
  'moderate_content',
  'ban_members',
  'suspend_members',
  'approve_join_requests',
  'assign_roles',
  'export_members',
  'view_analytics',
  'manage_settings',
] as const;

export type CommunityPermission = (typeof COMMUNITY_PERMISSIONS)[number];

const ALL: CommunityPermission[] = [...COMMUNITY_PERMISSIONS];

export const COMMUNITY_ROLE_PERMISSION_MATRIX: Record<string, CommunityPermission[]> = {
  owner: ALL,
  admin: ALL.filter((p) => p !== 'assign_roles'),
  [CommunityRoleType.MODERATOR]: [
    'view_community',
    'post_in_community',
    'manage_posts',
    'moderate_content',
    'ban_members',
    'suspend_members',
    'approve_join_requests',
    'manage_events',
  ],
  [CommunityRoleType.COACH]: [
    'view_community',
    'post_in_community',
    'manage_posts',
    'manage_events',
    'view_analytics',
  ],
  member: ['view_community', 'post_in_community'],
};

export function permissionsForRole(role: CommunityRoleType | 'owner' | 'member'): CommunityPermission[] {
  return COMMUNITY_ROLE_PERMISSION_MATRIX[role] ?? COMMUNITY_ROLE_PERMISSION_MATRIX.member;
}
