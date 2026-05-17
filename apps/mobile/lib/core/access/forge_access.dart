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
  static bool canEngage(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest;

  /// Library, history, playlists (signed-in only).
  static bool canUseLibrary(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest;

  /// Personalized home feed (signed-in only).
  static bool canViewPersonalizedFeed(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest;

  /// Upload — approved creator channel only (not platform admin).
  static bool canUpload(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;

  static bool canGoLive(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;

  static bool canApplyForCreator(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.viewer || tier == ForgeAccessTier.creatorRejected;

  /// Approved creator channel (not admin).
  static bool isApprovedCreator(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.creator;

  static bool isPlatformAdmin(ForgeAccessTier tier) =>
      tier == ForgeAccessTier.admin;

  /// Studio entry for apply/status (not guest or platform admin).
  static bool canOpenStudioEntry(ForgeAccessTier tier) =>
      tier != ForgeAccessTier.guest && tier != ForgeAccessTier.admin;
}
