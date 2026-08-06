import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../../history/data/history_repository.dart';
import '../../playlists/presentation/create_playlist_dialog.dart';

final libraryUnreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  try {
    final api = ref.read(apiClientProvider);
    final res = await api.dio.get('/notifications/unread-count');
    final data = res.data['data'];
    if (data is Map) return (data['count'] as num?)?.toInt() ?? 0;
    if (data is num) return data.toInt();
    return 0;
  } catch (_) {
    return 0;
  }
});

final libraryPlaylistCountsProvider =
    FutureProvider.autoDispose<({int? watchLater, int? liked, int? playlists})>((ref) async {
  try {
    final api = ref.read(apiClientProvider);
    final res = await api.dio.get('/playlists/me');
    final list = res.data['data'];
    if (list is! List) return (watchLater: null, liked: null, playlists: null);
    int? watchLater;
    int? liked;
    var custom = 0;
    for (final raw in list) {
      if (raw is! Map) continue;
      final p = Map<String, dynamic>.from(raw);
      final system = p['systemType'] as String?;
      final count = (p['videoCount'] as num?)?.toInt();
      if (system == 'watch_later') {
        watchLater = count;
      } else if (system == 'liked') {
        liked = count;
      } else if (system == null) {
        custom += 1;
      }
    }
    return (watchLater: watchLater, liked: liked, playlists: custom);
  } catch (_) {
    return (watchLater: null, liked: null, playlists: null);
  }
});

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ForgeTokens.of(context);
    final unread = ref.watch(libraryUnreadCountProvider).maybeWhen(
          data: (c) => c,
          orElse: () => 0,
        );
    final counts = ref.watch(libraryPlaylistCountsProvider).maybeWhen(
          data: (c) => c,
          orElse: () => (watchLater: null, liked: null, playlists: null),
        );
    final continueWatching = ref.watch(continueWatchingProvider);

    String shelfSubtitle(String fallback, int? count) {
      if (count == null) return fallback;
      return '$fallback · $count';
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('You'),
        actions: [
          TextButton.icon(
            onPressed: () async {
              final id = await showCreatePlaylistDialog(context, ref);
              if (!context.mounted) return;
              if (id != null) {
                ref.invalidate(libraryPlaylistCountsProvider);
                context.push('/playlists/$id');
              }
            },
            icon: const Icon(Icons.playlist_add, size: 20),
            label: const Text('New'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Library',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: t.onSurface,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            'History, playlists, and your channel',
            style: TextStyle(color: t.onSurfaceVariant),
          ),
          continueWatching.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (videos) {
              if (videos.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Continue watching',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: t.onSurface,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/history'),
                        child: const Text('See all'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 118,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: videos.length.clamp(0, 12),
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (_, i) => _ContinueWatchTile(video: videos[i]),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 20),
          ForgeCard(
            onTap: () => context.push('/explore'),
            child: const _LibraryRow(
              icon: Icons.trending_up,
              title: 'Trending & Explore',
              subtitle: 'Popular videos and categories',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/live'),
            child: const _LibraryRow(
              icon: Icons.sensors,
              title: 'Live',
              subtitle: 'Live and upcoming streams',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/history'),
            child: const _LibraryRow(
              icon: Icons.history,
              title: 'History',
              subtitle: 'Videos you have watched',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/subscriptions'),
            child: const _LibraryRow(
              icon: Icons.subscriptions_outlined,
              title: 'Subscriptions',
              subtitle: 'Latest from channels you subscribe to',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/profile/me?tab=videos'),
            child: const _LibraryRow(
              icon: Icons.video_library_outlined,
              title: 'Your videos',
              subtitle: 'Public uploads on your channel',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/playlists/me/watch-later'),
            child: _LibraryRow(
              icon: Icons.watch_later_outlined,
              title: 'Watch later',
              subtitle: shelfSubtitle('Videos saved for later', counts.watchLater),
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/playlists/me/liked'),
            child: _LibraryRow(
              icon: Icons.thumb_up_outlined,
              title: 'Liked videos',
              subtitle: shelfSubtitle('Videos you liked', counts.liked),
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/library/disliked'),
            child: const _LibraryRow(
              icon: Icons.thumb_down_outlined,
              title: 'Disliked videos',
              subtitle: 'Private list of videos you disliked',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/playlists'),
            child: _LibraryRow(
              icon: Icons.playlist_play,
              title: 'Playlists',
              subtitle: shelfSubtitle('Playlists you created or saved', counts.playlists),
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () async {
              final id = await showCreatePlaylistDialog(context, ref);
              if (!context.mounted) return;
              if (id != null) {
                ref.invalidate(libraryPlaylistCountsProvider);
                context.push('/playlists/$id');
              }
            },
            child: const _LibraryRow(
              icon: Icons.playlist_add,
              title: 'New playlist',
              subtitle: 'Create a public, unlisted, or private list',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/shorts'),
            child: const _LibraryRow(
              icon: Icons.movie_filter_outlined,
              title: 'Shorts',
              subtitle: 'Vertical videos to watch',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/notifications'),
            child: _LibraryRow(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              subtitle: 'Uploads, comments, and live alerts',
              badgeCount: unread,
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/messages'),
            child: const _LibraryRow(
              icon: Icons.chat_outlined,
              title: 'Messages',
              subtitle: 'Direct messages with creators and viewers',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/studio'),
            child: const _LibraryRow(
              icon: Icons.video_camera_front_outlined,
              title: 'Creator Studio',
              subtitle: 'Manage videos and analytics',
            ),
          ),
        ],
      ),
    );
  }
}

class _ContinueWatchTile extends ConsumerWidget {
  const _ContinueWatchTile({required this.video});

  final VideoModel video;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = ForgeTokens.of(context);
    final progress = video.viewerProgressSeconds ?? 0;
    final duration = video.durationSeconds ?? 0;
    final ratio = duration > 0 ? (progress / duration).clamp(0.0, 1.0) : 0.0;

    return SizedBox(
      width: 168,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 84,
              width: 168,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  InkWell(
                    onTap: () {
                      final tSec = progress > 0 ? '?t=$progress' : '';
                      context.push('/watch/${video.id}$tSec');
                    },
                    child: video.thumbnailUrl != null
                        ? CachedNetworkImage(imageUrl: video.thumbnailUrl!, fit: BoxFit.cover)
                        : ColoredBox(color: t.surfaceContainerHighest),
                  ),
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: LinearProgressIndicator(
                      value: ratio,
                      minHeight: 3,
                      backgroundColor: Colors.black26,
                      color: t.primary,
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: Material(
                      color: Colors.black54,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () async {
                          try {
                            await ref
                                .read(historyRepositoryProvider)
                                .removeFromWatchHistory(video.id);
                            ref.invalidate(continueWatchingProvider);
                          } catch (_) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Could not remove')),
                            );
                          }
                        },
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(Icons.close, size: 16, color: Colors.white),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            video.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.onSurface),
          ),
        ],
      ),
    );
  }
}

class _LibraryRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final int badgeCount;

  const _LibraryRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Row(
      children: [
        Icon(icon, color: t.primary, size: 28),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: t.onSurface,
                      ),
                    ),
                  ),
                  if (badgeCount > 0) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                      decoration: BoxDecoration(
                        color: t.error,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        badgeCount > 99 ? '99+' : '$badgeCount',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 13,
                  color: t.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Icon(Icons.chevron_right, color: t.outline),
      ],
    );
  }
}
