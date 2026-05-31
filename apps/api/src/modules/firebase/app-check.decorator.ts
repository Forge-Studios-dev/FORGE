import { SetMetadata } from '@nestjs/common';

export const APP_CHECK_KEY = 'forge_app_check';

/** Require valid Firebase App Check token when APP_CHECK_ENABLED=true. */
export const RequireAppCheck = () => SetMetadata(APP_CHECK_KEY, true);
