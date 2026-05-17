import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/app_constants.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/signup_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/reset_password_screen.dart';
import '../../features/auth/presentation/verify_email_screen.dart';
import '../../features/auth/presentation/waiting_approval_screen.dart';
import '../../features/auth/presentation/approval_rejected_screen.dart';
import '../../features/feed/presentation/feed_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/live/presentation/live_screen.dart';
import '../../features/watch/presentation/watch_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/studio/presentation/studio_screen.dart';
import '../../features/studio/presentation/studio_videos_screen.dart';
import '../../features/studio/presentation/studio_live_screen.dart';
import '../../features/studio/presentation/studio_settings_screen.dart';
import '../../features/studio/presentation/studio_analytics_screen.dart';
import '../../features/studio/presentation/studio_comments_screen.dart';
import '../../features/profile/presentation/profile_settings_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/upload/presentation/upload_screen.dart';
import '../../features/library/presentation/library_screen.dart';
import '../../features/shell/presentation/offline_screen.dart';
import '../../features/shell/presentation/maintenance_screen.dart';
import '../../shared/widgets/main_scaffold.dart';
import 'auth_redirect.dart';
import 'navigation_key.dart';

const _storage = FlutterSecureStorage();
const _protected = ['/studio', '/upload', '/notifications', '/history', '/profile/settings'];

Future<String?> _redirect(BuildContext context, GoRouterState state) async {
  final path = state.matchedLocation;
  final needsAuth = _protected.any((p) => path == p || path.startsWith('$p/'));
  if (!needsAuth) return null;
  final token = await _storage.read(key: AppConstants.accessTokenKey);
  if (token == null || token.isEmpty) {
    return '/login?next=${Uri.encodeComponent(path)}';
  }
  return creatorRouteRedirect(path);
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/feed',
    redirect: _redirect,
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/reset-password',
        builder: (_, state) {
          final token = state.uri.queryParameters['token'] ?? '';
          return ResetPasswordScreen(initialToken: token);
        },
      ),
      GoRoute(
        path: '/verify-email',
        builder: (_, state) {
          final token = state.uri.queryParameters['token'] ?? '';
          return VerifyEmailScreen(initialToken: token);
        },
      ),
      GoRoute(path: '/waiting-approval', builder: (_, __) => const WaitingApprovalScreen()),
      GoRoute(path: '/approval-rejected', builder: (_, __) => const ApprovalRejectedScreen()),
      GoRoute(path: '/offline', builder: (_, __) => const OfflineScreen()),
      GoRoute(path: '/maintenance', builder: (_, __) => const MaintenanceScreen()),
      GoRoute(path: '/studio', builder: (_, __) => const StudioScreen()),
      GoRoute(path: '/studio/videos', builder: (_, __) => const StudioVideosScreen()),
      GoRoute(path: '/studio/comments', builder: (_, __) => const StudioCommentsScreen()),
      GoRoute(path: '/studio/live', builder: (_, __) => const StudioLiveScreen()),
      GoRoute(path: '/studio/analytics', builder: (_, __) => const StudioAnalyticsScreen()),
      GoRoute(path: '/studio/settings', builder: (_, __) => const StudioSettingsScreen()),
      GoRoute(path: '/profile/settings', builder: (_, __) => const ProfileSettingsScreen()),
      GoRoute(path: '/upload', builder: (_, __) => const UploadScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
          GoRoute(
            path: '/profile/:username',
            builder: (_, state) => ProfileScreen(username: state.pathParameters['username']!),
          ),
          GoRoute(path: '/live', builder: (_, __) => const LiveScreen()),
          GoRoute(path: '/explore', builder: (_, __) => const ExploreScreen()),
          GoRoute(
            path: '/watch/:id',
            builder: (_, state) => WatchScreen(videoId: state.pathParameters['id']!),
          ),
          GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
          GoRoute(path: '/library', builder: (_, __) => const LibraryScreen()),
        ],
      ),
    ],
  );
});
