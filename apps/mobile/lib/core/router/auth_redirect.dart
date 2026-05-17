import '../access/forge_access.dart';
import 'auth_redirect_storage.dart' show readStoredUser;

export 'auth_redirect_storage.dart' show readStoredUser;

ForgeAccessTier _tier(Map<String, dynamic> user) =>
    ForgeAccess.tierFromUser(user, hasSession: true);

/// Upload requires approved + verified creator (YouTube: channel must be eligible).
Future<String?> creatorRouteRedirect(String path) async {
  final isUpload = path == '/upload' || path.startsWith('/upload/');
  final isStudio = path == '/studio' || path.startsWith('/studio/');
  if (!isUpload && !isStudio) return null;

  final user = await readStoredUser();
  if (user == null) return null;

  final tier = _tier(user);

  if (isUpload) {
    if (tier == ForgeAccessTier.creatorPending) return '/waiting-approval';
    if (tier == ForgeAccessTier.creatorRejected) return '/approval-rejected';
    if (!ForgeAccess.canUpload(tier)) return '/studio';
    return null;
  }

  // Studio sub-routes (not root): pending/rejected cannot manage channel yet
  if (isStudio && path != '/studio') {
    if (tier == ForgeAccessTier.creatorPending) return '/waiting-approval';
    if (tier == ForgeAccessTier.creatorRejected) return '/approval-rejected';
    if (tier == ForgeAccessTier.viewer) return '/studio';
  }

  return null;
}
