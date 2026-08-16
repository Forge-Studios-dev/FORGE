import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../router/navigation_key.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/presentation/mfa_challenge_screen.dart';

/// Catches the `forge://oauth-callback` redirect the system browser sends
/// after Google OAuth completes server-side (see auth.controller.ts
/// googleCallback, oauth.google.mobileSuccessUrl). Without this the app has
/// no way to learn the browser-side login succeeded — google_oauth_launcher.dart
/// only opens the browser and cannot see what happens next.
///
/// Uses the same `rootNavigatorKey.currentContext` post-mount navigation
/// pattern as ConnectivityGate.
class OAuthDeepLinkGate extends ConsumerStatefulWidget {
  final Widget child;
  const OAuthDeepLinkGate({super.key, required this.child});

  @override
  ConsumerState<OAuthDeepLinkGate> createState() => _OAuthDeepLinkGateState();
}

class _OAuthDeepLinkGateState extends ConsumerState<OAuthDeepLinkGate> {
  final _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;

  @override
  void initState() {
    super.initState();
    // Warm start / already-running app.
    _sub = _appLinks.uriLinkStream.listen(_handleUri, onError: (_) {});
    // Cold start — app was launched fresh by tapping the redirect link.
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) _handleUri(uri);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'forge' || uri.host != 'oauth-callback') return;

    final mfaChallengeToken = uri.queryParameters['mfaChallengeToken'];
    if (mfaChallengeToken != null && mfaChallengeToken.isNotEmpty) {
      final ctx = rootNavigatorKey.currentContext;
      if (ctx == null || !ctx.mounted) return;
      Navigator.of(ctx).push(
        MaterialPageRoute(
          builder: (_) => MfaChallengeScreen(challengeToken: mfaChallengeToken, next: null),
        ),
      );
      return;
    }

    final code = uri.queryParameters['code'];
    if (code == null || code.isEmpty) return;
    try {
      final data = await ref.read(authRepositoryProvider).completeOAuthExchange(code);
      final ctx = rootNavigatorKey.currentContext;
      if (ctx == null || !ctx.mounted) return;
      final user = data['user'] as Map<String, dynamic>?;
      if (user != null &&
          user['role'] == 'creator' &&
          user['creatorStatus'] != null &&
          user['creatorStatus'] != 'approved') {
        GoRouter.of(ctx).go(user['creatorStatus'] == 'rejected' ? '/approval-rejected' : '/waiting-approval');
        return;
      }
      GoRouter.of(ctx).go('/feed');
    } catch (_) {
      final ctx = rootNavigatorKey.currentContext;
      if (ctx != null && ctx.mounted) GoRouter.of(ctx).go('/login');
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
