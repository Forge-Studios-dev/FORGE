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
import '../../features/onboarding/presentation/splash_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/feed/presentation/feed_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/profile/presentation/profile_screen.dart';
import '../../features/live/presentation/live_screen.dart';
import '../../features/live/presentation/live_watch_screen.dart';
import '../../features/community/presentation/community_screen.dart';
import '../../features/community/presentation/community_text_room_screen.dart';
import '../../features/community/presentation/community_updates_screen.dart';
import '../../features/playlists/presentation/playlists_screen.dart';
import '../../features/playlists/presentation/playlist_detail_screen.dart';
import '../../features/community/presentation/community_voice_room_screen.dart';
import '../../features/watch/presentation/watch_screen.dart';
import '../../features/explore/presentation/explore_screen.dart';
import '../../features/studio/presentation/studio_screen.dart';
import '../../features/studio/presentation/studio_videos_screen.dart';
import '../../features/studio/presentation/studio_comments_screen.dart';
import '../../features/studio/presentation/studio_live_screen.dart';
import '../../features/studio/presentation/studio_live_debrief_screen.dart';
import '../../features/studio/presentation/studio_settings_screen.dart';
import '../../features/studio/presentation/studio_analytics_screen.dart';
import '../../features/studio/presentation/studio_tiers_screen.dart';
import '../../features/studio/presentation/studio_subscribers_screen.dart';
import '../../features/studio/presentation/studio_community_screen.dart';
import '../../features/community/presentation/discover_communities_screen.dart';
import '../../features/profile/presentation/my_memberships_screen.dart';
import '../../features/profile/presentation/profile_settings_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/messages/presentation/messages_screen.dart';
import '../../features/profile/presentation/follower_list_screen.dart';
import '../../features/upload/presentation/upload_screen.dart';
import '../../features/library/presentation/library_screen.dart';
import '../../features/shell/presentation/offline_screen.dart';
import '../../features/shell/presentation/maintenance_screen.dart';
import '../../features/shorts/presentation/shorts_screen.dart';
import '../../features/subscriptions/presentation/subscriptions_screen.dart';
import '../../features/playlists/presentation/system_playlist_screen.dart';
import '../../shared/widgets/main_scaffold.dart';
import 'auth_redirect.dart';
import 'navigation_key.dart';

const _storage = FlutterSecureStorage();

/// Routes that require a live session. Exported (not `_`-prefixed) so tests
/// exercise this real list instead of a hand-copied duplicate (HIGH-09) —
/// a future edit here is caught by auth_redirect_test.dart automatically.
const protectedRoutes = ['/studio', '/upload', '/notifications', '/messages', '/history', '/profile/settings', '/settings/memberships', '/library', '/profile', '/updates', '/playlists', '/subscriptions'];

// Screens a first-time signed-in user must still be able to reach even
// before completing onboarding (auth flows, the onboarding screen itself,
// and status/utility screens). Everything else funnels through
// `/onboarding` once, right after auth and before landing on `/feed`.
const onboardingExemptRoutes = [
  '/splash',
  '/onboarding',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/waiting-approval',
  '/approval-rejected',
  '/offline',
  '/maintenance',
];

/// Routing decision, factored out of `_redirect` so tests can drive it
/// directly with explicit session/onboarding state instead of mocking
/// FlutterSecureStorage's platform channel. Only the creator-tier check
/// (`/studio`, `/upload`) still reads storage internally, via
/// `creatorRouteRedirect` -> `readStoredUser`.
Future<String?> resolveRedirect({
  required String path,
  required bool hasSession,
  required bool onboardingDone,
}) async {
  final needsAuth = protectedRoutes.any((p) => path == p || path.startsWith('$p/'));

  if (needsAuth && !hasSession) {
    return '/login?next=${Uri.encodeComponent(path)}';
  }

  if (hasSession &&
      !onboardingExemptRoutes.any((p) => path == p || path.startsWith('$p/')) &&
      !onboardingDone) {
    return '/onboarding';
  }

  if (needsAuth) return creatorRouteRedirect(path);
  return null;
}

Future<String?> _redirect(BuildContext context, GoRouterState state) async {
  final path = state.matchedLocation;
  final token = await _storage.read(key: AppConstants.accessTokenKey);
  final hasSession = token != null && token.isNotEmpty;
  final onboardingDone = await _storage.read(key: AppConstants.onboardingCompleteKey);

  return resolveRedirect(
    path: path,
    hasSession: hasSession,
    onboardingDone: onboardingDone == 'true',
  );
}

int _studioCommunityTabIndex(String? tab) {
  switch (tab) {
    case 'members':
      return 1;
    case 'moderation':
      return 2;
    case 'settings':
      return 3;
    case 'rooms':
    case 'engagement': // LMS soft-retire — map old deep links to Rooms
    default:
      return 0;
  }
}

/// YouTube-style `t=` query (`90`, `1m30s`, `1h2m3s`).
int? _parseWatchTimeQuery(String? raw) {
  if (raw == null) return null;
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  if (RegExp(r'^\d+$').hasMatch(trimmed)) {
    return int.tryParse(trimmed);
  }
  final match = RegExp(r'^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$', caseSensitive: false)
      .firstMatch(trimmed);
  if (match == null || (match[1] == null && match[2] == null && match[3] == null)) {
    return null;
  }
  final h = int.tryParse(match[1] ?? '0') ?? 0;
  final m = int.tryParse(match[2] ?? '0') ?? 0;
  final s = int.tryParse(match[3] ?? '0') ?? 0;
  return h * 3600 + m * 60 + s;
}

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/splash',
    redirect: _redirect,
    errorBuilder: (context, state) => Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Page not found',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  state.error?.toString() ?? state.uri.toString(),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => context.go('/feed'),
                  child: const Text('Go home'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
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
      GoRoute(path: '/studio/videos', builder: (_, __) => const StudioVideosScreen()),
      GoRoute(path: '/studio/comments', builder: (_, __) => const StudioCommentsScreen()),
      GoRoute(path: '/studio/live', builder: (_, __) => const StudioLiveScreen()),
      GoRoute(
        path: '/studio/live/:id/debrief',
        builder: (_, state) => StudioLiveDebriefScreen(streamId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/studio/analytics', builder: (_, __) => const StudioAnalyticsScreen()),
      GoRoute(path: '/studio/tiers', builder: (_, __) => const StudioTiersScreen()),
      // Skill-economy LMS soft-retire — keep deep links from crashing; send to YouTube-parity surfaces.
      GoRoute(path: '/studio/bundles', redirect: (_, __) => '/studio/tiers'),
      GoRoute(path: '/studio/brands', redirect: (_, __) => '/studio'),
      GoRoute(path: '/studio/subscribers', builder: (_, __) => const StudioSubscribersScreen()),
      GoRoute(
        path: '/studio/community',
        builder: (_, state) => StudioCommunityScreen(
          initialTabIndex: _studioCommunityTabIndex(state.uri.queryParameters['tab']),
        ),
      ),
      GoRoute(
        path: '/studio/communities',
        redirect: (_, __) => '/studio/community',
      ),
      GoRoute(
        path: '/studio/rooms',
        redirect: (_, __) => '/studio/community?tab=rooms',
      ),
      GoRoute(
        path: '/studio/engagement',
        redirect: (_, __) => '/studio/community?tab=rooms',
      ),
      GoRoute(
        path: '/studio/moderation',
        redirect: (_, __) => '/studio/community?tab=moderation',
      ),
      GoRoute(path: '/studio/programs', redirect: (_, __) => '/studio/videos'),
      GoRoute(path: '/studio/courses', redirect: (_, __) => '/studio/videos'),
      GoRoute(path: '/studio/courses/:id', redirect: (_, __) => '/studio/videos'),
      GoRoute(path: '/courses/:id', redirect: (_, __) => '/feed'),
      GoRoute(path: '/discover/communities', builder: (_, __) => const DiscoverCommunitiesScreen()),
      GoRoute(path: '/discover/courses', redirect: (_, __) => '/feed'),
      GoRoute(path: '/studio/channel-points', redirect: (_, __) => '/studio'),
      GoRoute(path: '/studio/mentorship', redirect: (_, __) => '/studio'),
      GoRoute(path: '/studio/settings', builder: (_, __) => const StudioSettingsScreen()),
      GoRoute(path: '/studio/copilot', redirect: (_, __) => '/studio'),
      GoRoute(path: '/profile/settings', builder: (_, __) => const ProfileSettingsScreen()),
      GoRoute(path: '/settings/memberships', builder: (_, __) => const MyMembershipsScreen()),
      GoRoute(path: '/upload', builder: (_, __) => const UploadScreen()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/messages', builder: (_, __) => const MessagesScreen()),
      GoRoute(path: '/updates', builder: (_, __) => const CommunityUpdatesScreen()),
      GoRoute(path: '/playlists', builder: (_, __) => const PlaylistsScreen()),
      GoRoute(
        path: '/playlists/me/watch-later',
        builder: (_, __) => const SystemPlaylistScreen(kind: 'watch-later'),
      ),
      GoRoute(
        path: '/playlists/me/liked',
        builder: (_, __) => const SystemPlaylistScreen(kind: 'liked'),
      ),
      GoRoute(
        path: '/playlists/:id',
        builder: (_, state) => PlaylistDetailScreen(playlistId: state.pathParameters['id']!),
      ),
      // Immersive Shorts — outside shell so bottom nav does not cover the feed.
      GoRoute(
        path: '/shorts',
        builder: (_, state) => ShortsScreen(
          initialVideoId: state.uri.queryParameters['v'],
        ),
      ),
      // Immersive watch / live watch / community rooms — YouTube-like full canvas.
      GoRoute(
        path: '/watch/:id',
        builder: (_, state) {
          final t = state.uri.queryParameters['t'];
          final list = state.uri.queryParameters['list']?.trim();
          final lc = state.uri.queryParameters['lc']?.trim();
          return WatchScreen(
            videoId: state.pathParameters['id']!,
            initialSeekSeconds: _parseWatchTimeQuery(t),
            playlistId: (list != null && list.isNotEmpty) ? list : null,
            shuffle: state.uri.queryParameters['shuffle'] == '1',
            highlightCommentId: (lc != null && lc.isNotEmpty) ? lc : null,
          );
        },
      ),
      GoRoute(
        path: '/live/:id',
        builder: (_, state) => LiveWatchScreen(streamId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/community/:communityId/text/:roomId',
        builder: (_, state) => CommunityTextRoomScreen(
          communityId: state.pathParameters['communityId']!,
          roomId: state.pathParameters['roomId']!,
        ),
      ),
      GoRoute(
        path: '/community/:communityId/voice/:roomId',
        builder: (_, state) => CommunityVoiceRoomScreen(
          communityId: state.pathParameters['communityId']!,
          roomId: state.pathParameters['roomId']!,
        ),
      ),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
          // Studio root only — sub-screens (`/studio/videos`, etc.) stay as
          // full-screen pushes outside the shell (see MainScaffold nav).
          GoRoute(path: '/studio', builder: (_, __) => const StudioScreen()),
          GoRoute(
            path: '/profile/:username',
            builder: (_, state) => ProfileScreen(username: state.pathParameters['username']!),
          ),
          GoRoute(
            path: '/profile/:username/subscribers',
            builder: (_, state) => FollowerListScreen(
              username: state.pathParameters['username']!,
              following: false,
            ),
          ),
          GoRoute(
            path: '/profile/:username/subscriptions',
            builder: (_, state) => FollowerListScreen(
              username: state.pathParameters['username']!,
              following: true,
            ),
          ),
          GoRoute(
            path: '/profile/:username/followers',
            redirect: (_, state) => '/profile/${state.pathParameters['username']}/subscribers',
          ),
          GoRoute(
            path: '/profile/:username/following',
            redirect: (_, state) => '/profile/${state.pathParameters['username']}/subscriptions',
          ),
          GoRoute(
            path: '/profile/:username/programs/:slug',
            redirect: (_, state) => '/profile/${state.pathParameters['username']}',
          ),
          GoRoute(path: '/live', builder: (_, __) => const LiveScreen()),
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
          GoRoute(path: '/subscriptions', builder: (_, __) => const SubscriptionsScreen()),
          GoRoute(
            path: '/search',
            builder: (_, state) => ExploreScreen(
              initialQuery: state.uri.queryParameters['q'],
              autofocusSearch: true,
            ),
          ),
          GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
          GoRoute(path: '/library', builder: (_, __) => const LibraryScreen()),
        ],
      ),
    ],
  );
});
