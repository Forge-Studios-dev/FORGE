/// YouTube-style access tiers — keep in sync with packages/shared-types/src/access.ts

enum ForgeAccessTier {
  guest,
  viewer,
  creatorPending,
  creatorRejected,
  creator,
  admin,
}

class ForgeAccess {
  static ForgeAccessTier tierFromUser(Map<String, dynamic>? user, {required bool hasSession}) {
    if (!hasSession || user == null) return ForgeAccessTier.guest;
    final role = user['role'] as String?;
    final status = user['creatorStatus'] as String?;
    final verified = user['isVerified'] == true;

    if (role == 'admin') return ForgeAccessTier.admin;
    if (role == 'creator') {
      if (status == 'rejected') return ForgeAccessTier.creatorRejected;
      if (status == 'approved' && verified) return ForgeAccessTier.creator;
      return ForgeAccessTier.creatorPending;
    }
    return ForgeAccessTier.viewer;
  }

  /// Like, comment, follow (signed-in only).
  static bool canEngage(ForgeAccessTier tier) => tier != ForgeAccessTier.guest;

  /// Playlists, watch history, notifications.
  static bool canUseLibrary(ForgeAccessTier tier) => tier != ForgeAccessTier.guest;

  /// Personalized home feed (For You).
  static bool canViewPersonalizedFeed(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest;

  /// Upload — approved creator channel only.
  static bool canUpload(ForgeAccessTier tier) => tier == ForgeAccessTier.creator;

  static bool canGoLive(ForgeAccessTier tier) => tier == ForgeAccessTier.creator;

  static bool canApplyForCreator(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.viewer || tier == ForgeAccessTier.creatorRejected;

  static bool isApprovedCreator(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;

  static bool isPlatformAdmin(ForgeAccessTier tier) => tier == ForgeAccessTier.admin;

  /// Studio entry for apply/status (not guest or platform admin).
  static bool canOpenStudioEntry(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest && tier != ForgeAccessTier.admin;

  /// Consumer app create/upload button — channel owners only.
  static bool canUploadOnConsumerApp(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;

  static bool canGoLiveOnConsumerApp(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;
}
