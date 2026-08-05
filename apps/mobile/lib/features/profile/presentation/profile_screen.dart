import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/access/creator_status_provider.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../auth/data/auth_repository.dart';
import '../../live/data/live_repository.dart';
import '../../watch/data/watch_repository.dart';
import '../../../shared/models/video.dart';
import 'membership_panel.dart';
import 'channel_community_panel.dart';

final userVideosProvider = FutureProvider.autoDispose
    .family<List<VideoModel>, ({String userId, String type, String sort})>((ref, args) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get(
    '/users/${args.userId}/videos',
    queryParameters: {
      'limit': 30,
      'type': args.type,
      if (args.sort != 'newest') 'sort': args.sort,
    },
  );
  final list = response.data['data']['data'] as List<dynamic>? ?? [];
  return list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
});

final channelStreamsProvider = FutureProvider.autoDispose
    .family<({List<Map<String, dynamic>> live, List<Map<String, dynamic>> upcoming}), String>(
        (ref, creatorId) async {
  final repo = ref.read(liveRepositoryProvider);
  final results = await Future.wait([
    repo.getLiveStreams(creatorId: creatorId),
    repo.getUpcomingStreams(creatorId: creatorId),
  ]);
  return (live: results[0], upcoming: results[1]);
});

final channelPlaylistsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, userId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/users/$userId/playlists');
  final data = response.data['data'];
  if (data is List) {
    return data.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }
  if (data is Map && data['data'] is List) {
    return (data['data'] as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  return [];
});

final userProfileProvider = FutureProvider.autoDispose.family<UserModel, String>((ref, username) async {
  final client = ref.read(apiClientProvider);
  final response = username == 'me'
      ? await client.dio.get('/users/me')
      : await client.dio.get('/users/by-username/$username');
  return UserModel.fromJson(response.data['data'] as Map<String, dynamic>);
});

class ProfileScreen extends ConsumerStatefulWidget {
  final String username;
  const ProfileScreen({super.key, required this.username});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String _type = 'home';
  String _sort = 'newest';

  static const _tabs = <({String id, String label, IconData icon})>[
    (id: 'home', label: 'Home', icon: Icons.home_outlined),
    (id: 'video', label: 'Videos', icon: Icons.videocam_outlined),
    (id: 'short', label: 'Shorts', icon: Icons.movie_filter_outlined),
    (id: 'live', label: 'Live', icon: Icons.sensors),
    (id: 'playlists', label: 'Playlists', icon: Icons.playlist_play),
    (id: 'community', label: 'Community', icon: Icons.forum_outlined),
    (id: 'about', label: 'About', icon: Icons.info_outline),
  ];

  @override
  Widget build(BuildContext context) {
    final username = widget.username;
    final profileAsync = ref.watch(userProfileProvider(username));

    return Scaffold(
      appBar: AppBar(title: Text('@$username')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => const Center(child: Text('User not found')),
        data: (user) {
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _ProfileHeader(user: user, profileUsername: username)),
              if (username != 'me')
                SliverToBoxAdapter(child: MembershipPanel(creatorId: user.id)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: 40,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            for (final tab in _tabs)
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  avatar: Icon(tab.icon, size: 16),
                                  label: Text(tab.label),
                                  selected: _type == tab.id,
                                  onSelected: (_) => setState(() => _type = tab.id),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (_type == 'video' || _type == 'short') ...[
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: DropdownButton<String>(
                            value: _sort,
                            underline: const SizedBox.shrink(),
                            items: const [
                              DropdownMenuItem(value: 'newest', child: Text('Newest')),
                              DropdownMenuItem(value: 'popular', child: Text('Popular')),
                              DropdownMenuItem(value: 'oldest', child: Text('Oldest')),
                            ],
                            onChanged: (v) {
                              if (v == null) return;
                              setState(() => _sort = v);
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              if (_type == 'home')
                ..._homeSlivers(user, username)
              else if (_type == 'live')
                ..._liveSlivers(user.id)
              else if (_type == 'playlists')
                ..._playlistSlivers(user.id)
              else if (_type == 'community')
                ..._communitySlivers(user, username)
              else if (_type == 'about')
                ..._aboutSlivers(user)
              else
                ..._videoSlivers(user.id),
            ],
          );
        },
      ),
    );
  }

  List<Widget> _homeSlivers(UserModel user, String profileUsername) {
    final streamsAsync = ref.watch(channelStreamsProvider(user.id));
    final videosAsync = ref.watch(
      userVideosProvider((userId: user.id, type: 'video', sort: 'newest')),
    );
    final shortsAsync = ref.watch(
      userVideosProvider((userId: user.id, type: 'short', sort: 'newest')),
    );
    final t = ForgeTokens.of(context);

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        sliver: SliverList(
          delegate: SliverChildListDelegate([
            streamsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Center(child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (streams) {
                if (streams.live.isEmpty) return const SizedBox.shrink();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Live now',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _type = 'live'),
                          child: const Text('See all'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ...streams.live.take(3).map((s) => _StreamTile(stream: s, live: true)),
                    const SizedBox(height: 16),
                  ],
                );
              },
            ),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Uploads',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _type = 'video';
                    _sort = 'newest';
                  }),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            videosAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => Text(
                'Could not load uploads',
                style: TextStyle(color: t.onSurfaceVariant),
              ),
              data: (videos) {
                if (videos.isEmpty) {
                  return Text('No videos yet', style: TextStyle(color: t.onSurfaceVariant));
                }
                return Column(
                  children: videos.take(5).map((v) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: InkWell(
                        onTap: () => context.push('/watch/${v.id}'),
                        borderRadius: BorderRadius.circular(8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 140,
                                height: 79,
                                child: v.thumbnailUrl != null
                                    ? CachedNetworkImage(
                                        imageUrl: v.thumbnailUrl!,
                                        fit: BoxFit.cover,
                                      )
                                    : ColoredBox(color: t.surfaceContainerHighest),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    v.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: t.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${v.viewCount} views',
                                    style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Shorts',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _type = 'short';
                    _sort = 'newest';
                  }),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            shortsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => Text(
                'Could not load Shorts',
                style: TextStyle(color: t.onSurfaceVariant),
              ),
              data: (shorts) {
                if (shorts.isEmpty) {
                  return Text('No Shorts yet', style: TextStyle(color: t.onSurfaceVariant));
                }
                return SizedBox(
                  height: 180,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: shorts.take(12).length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final v = shorts[i];
                      return GestureDetector(
                        onTap: () => context.push('/watch/${v.id}'),
                        child: SizedBox(
                          width: 100,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: v.thumbnailUrl != null
                                      ? CachedNetworkImage(
                                          imageUrl: v.thumbnailUrl!,
                                          width: 100,
                                          fit: BoxFit.cover,
                                        )
                                      : ColoredBox(color: t.surfaceContainerHighest),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                v.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.onSurface),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => setState(() => _type = 'community'),
              icon: const Icon(Icons.forum_outlined, size: 18),
              label: const Text('Community posts'),
            ),
            if (profileUsername.isNotEmpty) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => setState(() => _type = 'about'),
                child: const Text('About this channel'),
              ),
            ],
          ]),
        ),
      ),
    ];
  }

  List<Widget> _videoSlivers(String userId) {
    final videosAsync = ref.watch(
      userVideosProvider((userId: userId, type: _type, sort: _sort)),
    );
    return [
      videosAsync.when(
        loading: () => const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
        error: (_, __) => SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load videos',
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
          ),
        ),
        data: (videos) => SliverPadding(
          padding: const EdgeInsets.all(8),
          sliver: videos.isEmpty
              ? SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(
                      _type == 'short' ? 'No Shorts yet' : 'No videos yet',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                    ),
                  ),
                )
              : _type == 'short'
                  ? SliverGrid(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) {
                          final v = videos[i];
                          return GestureDetector(
                            onTap: () => context.push('/watch/${v.id}'),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: v.thumbnailUrl != null
                                  ? CachedNetworkImage(
                                      imageUrl: v.thumbnailUrl!,
                                      fit: BoxFit.cover,
                                      width: double.infinity,
                                      height: double.infinity,
                                    )
                                  : Container(
                                      color: ForgeTokens.of(context).surfaceContainerHighest,
                                    ),
                            ),
                          );
                        },
                        childCount: videos.length,
                      ),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                        childAspectRatio: 9 / 16,
                      ),
                    )
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) {
                          final v = videos[i];
                          final t = ForgeTokens.of(context);
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: InkWell(
                              onTap: () => context.push('/watch/${v.id}'),
                              borderRadius: BorderRadius.circular(8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: SizedBox(
                                      width: 140,
                                      height: 79,
                                      child: v.thumbnailUrl != null
                                          ? CachedNetworkImage(
                                              imageUrl: v.thumbnailUrl!,
                                              fit: BoxFit.cover,
                                            )
                                          : ColoredBox(color: t.surfaceContainerHighest),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          v.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontWeight: FontWeight.w600,
                                            color: t.onSurface,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${v.viewCount} views',
                                          style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                        childCount: videos.length,
                      ),
                    ),
        ),
      ),
    ];
  }

  List<Widget> _playlistSlivers(String userId) {
    final playlistsAsync = ref.watch(channelPlaylistsProvider(userId));
    return [
      playlistsAsync.when(
        loading: () => const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
        error: (_, __) => SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load playlists',
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
          ),
        ),
        data: (playlists) => SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          sliver: playlists.isEmpty
              ? SliverToBoxAdapter(
                  child: Text(
                    'No public playlists yet.',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  ),
                )
              : SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, i) {
                      final p = playlists[i];
                      final id = p['id'] as String?;
                      final title = p['title'] as String? ?? 'Playlist';
                      final count = p['videoCount'] ?? p['itemCount'];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: ForgeTokens.of(context).outlineVariant),
                          ),
                          leading: Icon(Icons.playlist_play, color: ForgeTokens.of(context).primary),
                          title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
                          subtitle: count != null ? Text('$count videos') : null,
                          onTap: id == null ? null : () => context.push('/playlists/$id'),
                        ),
                      );
                    },
                    childCount: playlists.length,
                  ),
                ),
        ),
      ),
    ];
  }

  List<Widget> _communitySlivers(UserModel user, String profileUsername) {
    final viewingOwn = profileUsername == 'me' || profileUsername == user.username;
    final canCompose = viewingOwn &&
        (user.creatorStatus == 'approved' || user.role == 'creator' || user.role == 'admin');
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        sliver: SliverToBoxAdapter(
          child: ChannelCommunityPanel(
            creatorId: user.id,
            isOwner: canCompose,
          ),
        ),
      ),
    ];
  }

  List<Widget> _aboutSlivers(UserModel user) {
    final t = ForgeTokens.of(context);
    final joined = user.createdAt?.toLocal();
    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        sliver: SliverList(
          delegate: SliverChildListDelegate([
            Text(
              'About',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            Text(
              (user.bio != null && user.bio!.trim().isNotEmpty)
                  ? user.bio!
                  : 'No channel description yet.',
              style: TextStyle(height: 1.45, color: t.onSurfaceVariant),
            ),
            if (user.websiteUrl != null || user.channelLinks.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                'Links',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: t.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 8),
              if (user.websiteUrl != null && user.websiteUrl!.isNotEmpty)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.language, size: 20),
                  title: const Text('Website'),
                  onTap: () => launchUrl(
                    Uri.parse(user.websiteUrl!),
                    mode: LaunchMode.externalApplication,
                  ),
                ),
              ...user.channelLinks.map(
                (link) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.link, size: 20),
                  title: Text(link.title.isNotEmpty ? link.title : link.url),
                  onTap: () => launchUrl(
                    Uri.parse(link.url),
                    mode: LaunchMode.externalApplication,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _AboutStat(label: 'Subscribers', value: '${user.followerCount}'),
                ),
                Expanded(
                  child: _AboutStat(label: 'Videos', value: '${user.videoCount}'),
                ),
              ],
            ),
            if (joined != null) ...[
              const SizedBox(height: 12),
              _AboutStat(
                label: 'Joined',
                value:
                    '${joined.year}-${joined.month.toString().padLeft(2, '0')}-${joined.day.toString().padLeft(2, '0')}',
              ),
            ],
          ]),
        ),
      ),
    ];
  }

  List<Widget> _liveSlivers(String creatorId) {
    final streamsAsync = ref.watch(channelStreamsProvider(creatorId));
    return [
      streamsAsync.when(
        loading: () => const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
        error: (_, __) => SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Could not load streams',
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
          ),
        ),
        data: (streams) => SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              Text(
                'Live now',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              if (streams.live.isEmpty)
                Text(
                  'Not live right now.',
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                )
              else
                ...streams.live.map((s) => _StreamTile(stream: s, live: true)),
              const SizedBox(height: 20),
              Text(
                'Upcoming',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              if (streams.upcoming.isEmpty)
                Text(
                  'No upcoming streams scheduled.',
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                )
              else
                ...streams.upcoming.map((s) => _StreamTile(stream: s, live: false)),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.push('/live'),
                child: const Text('Browse all live'),
              ),
            ]),
          ),
        ),
      ),
    ];
  }
}

class _StreamTile extends StatelessWidget {
  const _StreamTile({required this.stream, required this.live});

  final Map<String, dynamic> stream;
  final bool live;

  @override
  Widget build(BuildContext context) {
    final id = stream['id'] as String?;
    final title = stream['title'] as String? ?? 'Stream';
    final viewers = stream['viewerCount'];
    final scheduled = stream['scheduledAt'] as String?;
    DateTime? when;
    if (scheduled != null) when = DateTime.tryParse(scheduled)?.toLocal();

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: ForgeTokens.of(context).outlineVariant),
        ),
        title: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: live
            ? Text(
                viewers is num ? 'LIVE · $viewers' : 'LIVE',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: ForgeTokens.of(context).error,
                ),
              )
            : when != null
                ? Text(
                    '${when.month}/${when.day} ${when.hour.toString().padLeft(2, '0')}:${when.minute.toString().padLeft(2, '0')}',
                    style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant),
                  )
                : null,
        onTap: id == null ? null : () => context.push('/live/$id'),
      ),
    );
  }
}

class _AboutStat extends StatelessWidget {
  const _AboutStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: t.onSurfaceVariant)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: t.onSurface),
        ),
      ],
    );
  }
}

class _ProfileHeader extends ConsumerStatefulWidget {
  final UserModel user;
  final String profileUsername;
  const _ProfileHeader({required this.user, required this.profileUsername});

  @override
  ConsumerState<_ProfileHeader> createState() => _ProfileHeaderState();
}

class _ProfileHeaderState extends ConsumerState<_ProfileHeader> {
  late bool _following;
  bool _followBusy = false;

  @override
  void initState() {
    super.initState();
    _following = widget.user.viewerFollowing;
  }

  @override
  void didUpdateWidget(covariant _ProfileHeader oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.id != widget.user.id) {
      _following = widget.user.viewerFollowing;
    }
  }

  Future<void> _toggleFollow() async {
    if (_followBusy) return;
    setState(() => _followBusy = true);
    try {
      final client = ref.read(apiClientProvider);
      if (_following) {
        await client.dio.delete('/channels/${widget.user.id}/subscribe');
      } else {
        await client.dio.post('/channels/${widget.user.id}/subscribe');
      }
      setState(() => _following = !_following);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to subscribe to channels')),
        );
      }
    } finally {
      if (mounted) setState(() => _followBusy = false);
    }
  }

  Future<void> _setNotify(String level) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch(
        '/channels/${widget.user.id}/subscription/notify',
        data: {'notifyLevel': level},
      );
      if (mounted) {
        final label = switch (level) {
          'all' => 'All notifications',
          'personalized' => 'Personalized',
          _ => 'None',
        };
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(label)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update notifications')),
        );
      }
    }
  }

  Future<void> _reportChannel(UserModel user) async {
    const reasons = [
      'Spam or misleading',
      'Hate speech or harassment',
      'Impersonation',
      'Copyright infringement',
      'Privacy violation',
      'Other',
    ];
    final reason = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text('Report channel', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            ...reasons.map(
              (r) => ListTile(
                title: Text(r),
                onTap: () => Navigator.pop(ctx, r),
              ),
            ),
          ],
        ),
      ),
    );
    if (reason == null) return;
    try {
      await ref.read(watchRepositoryProvider).reportUser(userId: user.id, reason: reason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report channels')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final profileUsername = widget.profileUsername;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 40,
                backgroundColor: Theme.of(context).colorScheme.primary,
                backgroundImage: user.avatarUrl != null
                    ? CachedNetworkImageProvider(user.avatarUrl!)
                    : null,
                child: user.avatarUrl == null
                    ? Text(user.displayName[0], style: TextStyle(fontSize: 28, color: ForgeTokens.of(context).onPrimary, fontWeight: FontWeight.bold))
                    : null,
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _Stat(count: user.videoCount, label: 'Videos'),
                    _Stat(
                      count: user.followerCount,
                      label: 'Subscribers',
                      onTap: () => context.push('/profile/${user.username}/subscribers'),
                    ),
                    _Stat(
                      count: user.followingCount,
                      label: 'Subscriptions',
                      onTap: () => context.push('/profile/${user.username}/subscriptions'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(user.displayName, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          Text('@${user.username}', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13)),
          if (user.bio != null && user.bio!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(user.bio!, style: TextStyle(fontSize: 14, color: ForgeTokens.of(context).onSurface)),
          ],
          if (user.websiteUrl != null || user.channelLinks.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (user.websiteUrl != null && user.websiteUrl!.isNotEmpty)
                  ActionChip(
                    avatar: Icon(Icons.language, size: 16),
                    label: const Text('Website'),
                    onPressed: () => launchUrl(
                      Uri.parse(user.websiteUrl!),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ...user.channelLinks.map(
                  (link) => ActionChip(
                    avatar: const Icon(Icons.link, size: 16),
                    label: Text(link.title.isNotEmpty ? link.title : 'Link'),
                    onPressed: () => launchUrl(
                      Uri.parse(link.url),
                      mode: LaunchMode.externalApplication,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (profileUsername != 'me') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => context.push('/community/${user.id}'),
              icon: const Icon(Icons.forum_outlined, size: 18),
              label: const Text('Community'),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: ForgeTokens.of(context).outlineVariant),
              ),
            ),
          ],
          if (profileUsername == 'me') ...[
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.settings, color: ForgeTokens.of(context).onSurfaceVariant),
              title: const Text('Settings'),
              onTap: () => context.push('/profile/settings'),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.history, color: ForgeTokens.of(context).onSurfaceVariant),
              title: const Text('Watch history'),
              onTap: () => context.push('/history'),
            ),
            if (!user.isVerified) ...[
              const SizedBox(height: 8),
              Material(
                color: ForgeTokens.of(context).warning.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Verify your email', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      TextButton(
                        onPressed: () async {
                          try {
                            await ref.read(authRepositoryProvider).resendVerificationEmail();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Check your inbox for the verification link.')),
                              );
                            }
                          } catch (_) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Could not resend. Try again later.')),
                              );
                            }
                          }
                        },
                        child: const Text('Resend verification email'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            if (user.role == 'user') ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.tonal(
                  onPressed: () async {
                    try {
                      await ref.read(authRepositoryProvider).requestCreator();
                      ref.invalidate(userProfileProvider('me'));
                      ref.invalidate(creatorTierProvider);
                      if (context.mounted) context.go('/waiting-approval');
                    } catch (_) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Could not submit creator request.')),
                        );
                      }
                    }
                  },
                  child: const Text('Become a creator'),
                ),
              ),
            ],
          ],
          if (profileUsername != 'me') ...[
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: _following
                  ? PopupMenuButton<String>(
                      tooltip: 'Subscription options',
                      onSelected: (value) async {
                        if (value == 'unsubscribe') {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Unsubscribe?'),
                              content: const Text(
                                'You will stop receiving updates from this channel.',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Cancel'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text('Unsubscribe'),
                                ),
                              ],
                            ),
                          );
                          if (ok == true) await _toggleFollow();
                        } else {
                          await _setNotify(value);
                        }
                      },
                      itemBuilder: (context) => const [
                        PopupMenuItem(value: 'all', child: Text('All')),
                        PopupMenuItem(value: 'personalized', child: Text('Personalized')),
                        PopupMenuItem(value: 'none', child: Text('None')),
                        PopupMenuDivider(),
                        PopupMenuItem(value: 'unsubscribe', child: Text('Unsubscribe')),
                      ],
                      child: Material(
                        color: ForgeTokens.of(context).surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(8),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.notifications_active, size: 18),
                              SizedBox(width: 8),
                              Text('Subscribed'),
                              Icon(Icons.arrow_drop_down, size: 20),
                            ],
                          ),
                        ),
                      ),
                    )
                  : OutlinedButton(
                      onPressed: _followBusy ? null : _toggleFollow,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: ForgeTokens.of(context).outlineVariant),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Subscribe'),
                    ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      final url = '${AppConstants.webBaseUrl}/${user.username}';
                      Share.share('${user.displayName}\n$url');
                    },
                    icon: Icon(Icons.share_outlined, size: 18),
                    label: const Text('Share'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _reportChannel(user),
                    icon: const Icon(Icons.flag_outlined, size: 18),
                    label: const Text('Report'),
                  ),
                ),
              ],
            ),
          ],
          if (user.role == 'creator' && user.creatorStatus == 'pending') ...[
            const SizedBox(height: 12),
            Text('Creator approval pending', style: TextStyle(color: ForgeTokens.of(context).warning)),
          ],
          if (user.role == 'creator' && user.creatorStatus == 'rejected') ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => context.push('/approval-rejected'),
              child: const Text('View rejection details'),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final int count;
  final String label;
  final VoidCallback? onTap;
  const _Stat({required this.count, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final child = Column(
      children: [
        Text(count > 999 ? '${(count / 1000).toStringAsFixed(1)}K' : count.toString(),
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        Text(label, style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 12)),
      ],
    );
    if (onTap == null) return child;
    return GestureDetector(onTap: onTap, child: child);
  }
}
