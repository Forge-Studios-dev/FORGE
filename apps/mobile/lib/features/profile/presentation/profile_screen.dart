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
import '../../watch/data/watch_repository.dart';
import '../../../shared/models/video.dart';
import 'membership_panel.dart';

final userVideosProvider =
    FutureProvider.autoDispose.family<List<VideoModel>, ({String userId, String type})>((ref, args) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get(
    '/users/${args.userId}/videos',
    queryParameters: {'limit': 30, 'type': args.type},
  );
  final list = response.data['data']['data'] as List<dynamic>? ?? [];
  return list.map((e) => VideoModel.fromJson(e as Map<String, dynamic>)).toList();
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
  String _type = 'video';

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
          final videosAsync = ref.watch(
            userVideosProvider((userId: user.id, type: _type)),
          );
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _ProfileHeader(user: user, profileUsername: username)),
              if (username != 'me')
                SliverToBoxAdapter(child: MembershipPanel(creatorId: user.id)),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'video', label: Text('Videos'), icon: Icon(Icons.videocam_outlined, size: 16)),
                      ButtonSegment(value: 'short', label: Text('Shorts'), icon: Icon(Icons.movie_filter_outlined, size: 16)),
                    ],
                    selected: {_type},
                    onSelectionChanged: (s) => setState(() => _type = s.first),
                  ),
                ),
              ),
              videosAsync.when(
                loading: () => const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
                error: (_, __) => const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('Could not load videos', style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
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
                              style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                            ),
                          ),
                        )
                      : SliverGrid(
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
                                      : Container(color: ForgeTokens.surfaceContainerHighest),
                                ),
                              );
                            },
                            childCount: videos.length,
                          ),
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: _type == 'short' ? 3 : 2,
                            mainAxisSpacing: 4,
                            crossAxisSpacing: 4,
                            childAspectRatio: _type == 'short' ? 9 / 16 : 16 / 9,
                          ),
                        ),
                ),
              ),
            ],
          );
        },
      ),
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
        await client.dio.delete('/follow/${widget.user.id}');
      } else {
        await client.dio.post('/follow/${widget.user.id}');
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
                    ? Text(user.displayName[0], style: const TextStyle(fontSize: 28, color: ForgeTokens.onPrimary, fontWeight: FontWeight.bold))
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
                      onTap: () => context.push('/profile/${user.username}/followers'),
                    ),
                    _Stat(
                      count: user.followingCount,
                      label: 'Subscriptions',
                      onTap: () => context.push('/profile/${user.username}/following'),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(user.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          Text('@${user.username}', style: const TextStyle(color: ForgeTokens.onSurfaceVariant, fontSize: 13)),
          if (user.bio != null && user.bio!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(user.bio!, style: const TextStyle(fontSize: 14, color: ForgeTokens.onSurface)),
          ],
          if (user.websiteUrl != null || user.channelLinks.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (user.websiteUrl != null && user.websiteUrl!.isNotEmpty)
                  ActionChip(
                    avatar: const Icon(Icons.language, size: 16),
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
                side: const BorderSide(color: ForgeTokens.outlineVariant),
              ),
            ),
          ],
          if (profileUsername == 'me') ...[
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.settings, color: ForgeTokens.onSurfaceVariant),
              title: const Text('Settings'),
              onTap: () => context.push('/profile/settings'),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.history, color: ForgeTokens.onSurfaceVariant),
              title: const Text('Watch history'),
              onTap: () => context.push('/history'),
            ),
            if (!user.isVerified) ...[
              const SizedBox(height: 8),
              Material(
                color: ForgeTokens.warning.withValues(alpha: 0.2),
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
                          await _toggleFollow();
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
                        color: ForgeTokens.surfaceContainerHighest,
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
                        side: const BorderSide(color: ForgeTokens.outlineVariant),
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
                    icon: const Icon(Icons.share_outlined, size: 18),
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
            const Text('Creator approval pending', style: TextStyle(color: ForgeTokens.warning)),
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
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        Text(label, style: const TextStyle(color: ForgeTokens.onSurfaceVariant, fontSize: 12)),
      ],
    );
    if (onTap == null) return child;
    return GestureDetector(onTap: onTap, child: child);
  }
}
