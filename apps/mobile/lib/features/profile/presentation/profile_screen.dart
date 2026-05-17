import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../auth/data/auth_repository.dart';
import '../../../shared/models/video.dart';

final userVideosProvider = FutureProvider.autoDispose.family<List<VideoModel>, String>((ref, userId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/users/$userId/videos', queryParameters: {'limit': 30});
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

class ProfileScreen extends ConsumerWidget {
  final String username;
  const ProfileScreen({super.key, required this.username});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(userProfileProvider(username));

    return Scaffold(
      appBar: AppBar(title: Text('@$username')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('User not found')),
        data: (user) {
          final videosAsync = ref.watch(userVideosProvider(user.id));
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _ProfileHeader(user: user, profileUsername: username)),
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
                    child: Text('Could not load videos', style: TextStyle(color: Colors.grey)),
                  ),
                ),
                data: (videos) => SliverPadding(
                  padding: const EdgeInsets.all(8),
                  sliver: videos.isEmpty
                      ? const SliverToBoxAdapter(
                          child: Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('No videos yet', style: TextStyle(color: Colors.grey)),
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
                                      : Container(color: const Color(0xFF1A1A24)),
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
  bool _following = false;
  bool _followBusy = false;

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
          const SnackBar(content: Text('Sign in to follow creators')),
        );
      }
    } finally {
      if (mounted) setState(() => _followBusy = false);
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
                    ? Text(user.displayName[0], style: const TextStyle(fontSize: 28, color: Colors.white, fontWeight: FontWeight.bold))
                    : null,
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _Stat(count: user.videoCount, label: 'Videos'),
                    _Stat(count: user.followerCount, label: 'Followers'),
                    _Stat(count: user.followingCount, label: 'Following'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(user.displayName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          Text('@${user.username}', style: const TextStyle(color: Colors.grey, fontSize: 13)),
          if (profileUsername == 'me') ...[
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.settings, color: Colors.white70),
              title: const Text('Settings'),
              onTap: () => context.push('/profile/settings'),
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.history, color: Colors.white70),
              title: const Text('Watch history'),
              onTap: () => context.push('/history'),
            ),
            if (!user.isVerified) ...[
              const SizedBox(height: 8),
              Material(
                color: const Color(0xFF2A2410),
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
            if (user.role == 'creator' && user.creatorStatus == 'pending') ...[
              const SizedBox(height: 12),
              const Text('Creator approval pending', style: TextStyle(color: Colors.amber)),
            ],
            if (user.role == 'creator' && user.creatorStatus == 'rejected') ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.push('/approval-rejected'),
                child: const Text('View rejection details'),
              ),
            ],
          ],
          const SizedBox(height: 16),
          if (profileUsername != 'me')
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _followBusy ? null : _toggleFollow,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.white24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text(_following ? 'Following' : 'Follow'),
              ),
            ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  final int count;
  final String label;
  const _Stat({required this.count, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(count > 999 ? '${(count / 1000).toStringAsFixed(1)}K' : count.toString(),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }
}
