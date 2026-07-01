/** Feature flag: hide channels[] in community payloads and block channel CRUD mutations. */
export const CHANNELS_DEPRECATED_FLAG = 'community_channels_deprecated';

/** RFC 8594 sunset date for legacy channel HTTP routes (message routes remain bridged to rooms). */
export const CHANNELS_API_SUNSET = 'Sat, 01 Sep 2026 00:00:00 GMT';

export const CHANNELS_MIGRATION_HINT =
  'Use POST /creators/me/communities/:communityId/rooms (roomType=text|voice|stage). Channel messages are bridged to rooms when mapped.';
