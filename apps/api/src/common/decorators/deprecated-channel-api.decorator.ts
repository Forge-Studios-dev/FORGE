import { SetMetadata } from '@nestjs/common';

export const DEPRECATED_CHANNEL_API_KEY = 'deprecatedChannelApi';

/** Marks legacy community channel routes; adds Deprecation/Sunset response headers. */
export const DeprecatedChannelApi = () => SetMetadata(DEPRECATED_CHANNEL_API_KEY, true);
