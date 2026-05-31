import { Permission, permissionsForUser } from './permissions';
import { CreatorStatus, User, UserRole } from '../../modules/users/entities/user.entity';

function user(partial: Partial<User>): User {
  return {
    role: UserRole.USER,
    isVerified: false,
    isActive: true,
    creatorStatus: null,
    ...partial,
  } as User;
}

describe('permissionsForUser', () => {
  it('denies ENGAGE for unverified viewers', () => {
    const perms = permissionsForUser(user({ role: UserRole.USER, isVerified: false }));
    expect(perms).not.toContain(Permission.ENGAGE);
    expect(perms).not.toContain(Permission.USE_LIBRARY);
  });

  it('grants ENGAGE for verified viewers', () => {
    const perms = permissionsForUser(user({ role: UserRole.USER, isVerified: true }));
    expect(perms).toContain(Permission.ENGAGE);
    expect(perms).toContain(Permission.USE_LIBRARY);
  });

  it('returns no permissions when account is inactive', () => {
    const perms = permissionsForUser(user({ isActive: false, isVerified: true }));
    expect(perms).toEqual([]);
  });
});
