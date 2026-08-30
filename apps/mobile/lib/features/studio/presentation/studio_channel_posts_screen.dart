import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../auth/data/auth_repository.dart';
import '../../profile/presentation/channel_community_panel.dart';

/// Studio surface for YouTube-style channel Community posts (compose + feed).
class StudioChannelPostsScreen extends ConsumerStatefulWidget {
  const StudioChannelPostsScreen({super.key});

  @override
  ConsumerState<StudioChannelPostsScreen> createState() => _StudioChannelPostsScreenState();
}

class _StudioChannelPostsScreenState extends ConsumerState<StudioChannelPostsScreen> {
  String? _creatorId;
  String? _username;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      if (!mounted) return;
      setState(() {
        _creatorId = user?['id'] as String?;
        _username = user?['username'] as String?;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Community posts'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
        actions: [
          if (_username != null && _username!.isNotEmpty)
            TextButton(
              onPressed: () => context.push('/profile/$_username?tab=community'),
              child: const Text('View channel'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _creatorId == null
              ? Center(
                  child: Text(
                    'Sign in as a creator to post updates.',
                    style: TextStyle(color: t.onSurfaceVariant),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Posts appear on your public channel Community tab.',
                        style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      ChannelCommunityPanel(creatorId: _creatorId!, isOwner: true),
                    ],
                  ),
                ),
    );
  }
}
