import type { User } from '../../modules/users/entities/user.entity';

/** Full user row loaded once per JWT request (permissions / creator guards). */
export const AUTH_USER_CLS_KEY = 'authUser';

export type AuthUserSnapshot = Pick<User, 'id' | 'email' | 'role' | 'creatorStatus' | 'isVerified'>;
