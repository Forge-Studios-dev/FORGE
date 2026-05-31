import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFIED_KEY = 'forge_require_verified';

/** Require `isVerified` on the authenticated user (API guard). */
export const RequireVerified = () => SetMetadata(REQUIRE_VERIFIED_KEY, true);
