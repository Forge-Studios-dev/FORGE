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
import '../../features/live/presentation/live_watch_screen.dart';
import '../../features/community/presentation/community_screen.dart';
import '../../features/watch/presentation/watch_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/studio/presentation/studio_screen.dart';
import '../../features/studio/presentation/studio_videos_screen.dart';
import '../../features/studio/presentation/studio_comments_screen.dart';
import '../../features/studio/presentation/studio_live_screen.dart';
import '../../features/studio/presentation/studio_settings_screen.dart';
import '../../features/studio/presentation/studio_analytics_screen.dart';
import '../../features/studio/presentation/studio_tiers_screen.dart';
import '../../features/studio/presentation/studio_community_screen.dart';
import '../../features/studio/presentation/studio_moderation_screen.dart';
import '../../features/studio/presentation/studio_courses_screen.dart';
import '../../features/studio/presentation/studio_course_detail_screen.dart';
import '../../features/studio/presentation/course_viewer_screen.dart';
import '../../features/community/presentation/discover_communities_screen.dart';
import '../../features/studio/presentation/studio_subscribers_screen.dart';
import '../../features/profile/presentation/profile_settings_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/messages/presentation/messages_screen.dart';
import '../../features/profile/presentation/follower_list_screen.dart';
import '../../features/upload/presentation/upload_screen.dart';
import '../../features/library/presentation/library_screen.dart';
import '../../features/shell/presentation/offline_screen.dart';
import '../../features/shell/presentation/maintenance_screen.dart';
import '../../shared/widgets/main_scaffold.dart';
import 'auth_redirect.dart';
import 'navigation_key.dart';

const _storage = FlutterSecureStorage();
const _protected = ['/studio', '/upload', '/notifications', '/messages', '/history', '/profile/settings', '/library', '/profile'];

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
      GoRoute(path: '/studio/tiers', builder: (_, __) => const StudioTiersScreen()),
      GoRoute(path: '/studio/subscribers', builder: (_, __) => const StudioSubscribersScreen()),
      GoRoute(path: '/studio/community', builder: (_, __) => const StudioCommunityScreen()),
      GoRoute(path: '/studio/moderation', builder: (_, __) => const StudioModerationScreen()),
      GoRoute(path: '/studio/courses', builder: (_, __) => const StudioCoursesScreen()),
      GoRoute(
        path: '/studio/courses/:id',
        builder: (_, state) => StudioCourseDetailScreen(courseId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/courses/:id',
        builder: (_, state) => CourseViewerScreen(courseId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/discover/communities', builder: (_, __) => const DiscoverCommunitiesScreen()),
      GoRoute(path: '/studio/settings', builder: (_, __) => const StudioSettingsScreen()),
      GoRoute(path: '/profile/settings', builder: (_, __) => const ProfileSettingsScreen()),
      GoRoute(path: '/upload', builder: (_, __) => const UploadScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/messages', builder: (_, __) => const MessagesScreen()),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
          GoRoute(
            path: '/profile/:username',
            builder: (_, state) => ProfileScreen(username: state.pathParameters['username']!),
          ),
          GoRoute(
            path: '/profile/:username/followers',
            builder: (_, state) => FollowerListScreen(
              username: state.pathParameters['username']!,
              following: false,
            ),
          ),
          GoRoute(
            path: '/profile/:username/following',
            builder: (_, state) => FollowerListScreen(
              username: state.pathParameters['username']!,
              following: true,
            ),
          ),
          GoRoute(path: '/live', builder: (_, __) => const LiveScreen()),
          GoRoute(
            path: '/live/:id',
            builder: (_, state) => LiveWatchScreen(streamId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/community/:creatorId',
            builder: (_, state) => CommunityScreen(creatorId: state.pathParameters['creatorId']!),
          ),
          GoRoute(
            path: '/community/:creatorId/c/:slug',
            builder: (_, state) => CommunityScreen(
              creatorId: state.pathParameters['creatorId']!,
              communitySlug: state.pathParameters['slug'],
            ),
          ),
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
