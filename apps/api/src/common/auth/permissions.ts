import { CreatorStatus, User, UserRole } from '../../modules/users/entities/user.entity';

export enum Permission {
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  UPLOAD_VIDEO = 'UPLOAD_VIDEO',
  START_STREAM = 'START_STREAM',
  MANAGE_PLATFORM = 'MANAGE_PLATFORM',
}

export function permissionsForUser(user: User): Permission[] {
  if (user.role === UserRole.ADMIN) {
    return [
      Permission.VIEW_DASHBOARD,
      Permission.UPLOAD_VIDEO,
      Permission.START_STREAM,
      Permission.MANAGE_PLATFORM,
    ];
  }

  if (user.role === UserRole.CREATOR) {
    const creatorApproved =
      user.isVerified === true && user.creatorStatus === CreatorStatus.APPROVED;

    return [
      Permission.VIEW_DASHBOARD,
      ...(creatorApproved ? [Permission.UPLOAD_VIDEO, Permission.START_STREAM] : []),
    ];
  }

  return [];
}

