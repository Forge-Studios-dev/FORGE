import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../router/auth_redirect_storage.dart' show readStoredUser;
import 'forge_access.dart';

/// Best-effort, no-network-call creator-tier lookup from the locally cached
/// user profile (same `readStoredUser()` used by the router's
/// `creatorRouteRedirect`). Drives the role-aware bottom nav in
/// `MainScaffold` (Studio tab for approved creators).
///
/// This is a plain (non-autoDispose) provider so the cheap secure-storage
/// read only happens once per app session; call
/// `ref.invalidate(creatorTierProvider)` after any flow that changes the
/// stored user's role/creatorStatus/isVerified (see profile_screen.dart and
/// verify_email_screen.dart) so the shell picks it up without an app
/// restart.
final creatorTierProvider = FutureProvider<ForgeAccessTier>((ref) async {
  final user = await readStoredUser();
  return ForgeAccess.tierFromUser(user, hasSession: user != null);
});
