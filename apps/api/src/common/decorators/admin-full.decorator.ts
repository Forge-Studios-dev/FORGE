import { SetMetadata } from '@nestjs/common';

export const ADMIN_FULL_KEY = 'adminFull';

/** Restrict route to platform admins with adminTier=full (not moderators). */
export const AdminFullOnly = () => SetMetadata(ADMIN_FULL_KEY, true);
