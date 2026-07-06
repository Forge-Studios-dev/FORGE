import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../router/navigation_key.dart';

/// Screens where an automatic redirect to `/offline` would be actively
/// harmful (auth forms mid-entry, the offline screen itself, etc.) — these
/// are left alone even if connectivity drops while the user is on them.
const _connectivityExempt = [
  '/splash',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/offline',
  '/maintenance',
];

/// Root-level connectivity watcher. Wraps `MaterialApp.router` in `main.dart`
/// and makes the previously-dead `/offline` route real: when connectivity
/// drops it navigates to `/offline`, and when it's regained it navigates
/// back to `/feed` (mirroring the OfflineScreen's own "Retry" button).
///
/// Uses the same `rootNavigatorKey.currentContext` + `GoRouter.of(ctx)`
/// pattern already used by `ApiClient._refreshTokens` for post-mount
/// navigation from outside the widget tree.
class ConnectivityGate extends StatefulWidget {
  final Widget child;
  const ConnectivityGate({super.key, required this.child});

  @override
  State<ConnectivityGate> createState() => _ConnectivityGateState();
}

class _ConnectivityGateState extends State<ConnectivityGate> {
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _weRedirectedToOffline = false;

  @override
  void initState() {
    super.initState();
    _sub = Connectivity().onConnectivityChanged.listen(_handle);
  }

  void _handle(List<ConnectivityResult> results) {
    final offline = results.isEmpty || results.every((r) => r == ConnectivityResult.none);
    final ctx = rootNavigatorKey.currentContext;
    if (ctx == null || !ctx.mounted) return;

    try {
      if (offline) {
        final location = GoRouterState.of(ctx).matchedLocation;
        final isExempt = _connectivityExempt.any((p) => location == p || location.startsWith('$p/'));
        if (isExempt || location == '/offline') return;
        _weRedirectedToOffline = true;
        GoRouter.of(ctx).go('/offline');
      } else if (_weRedirectedToOffline) {
        _weRedirectedToOffline = false;
        final location = GoRouterState.of(ctx).matchedLocation;
        if (location == '/offline') {
          GoRouter.of(ctx).go('/feed');
        }
      }
    } catch (_) {
      // Best-effort — never let a connectivity callback crash the app.
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
