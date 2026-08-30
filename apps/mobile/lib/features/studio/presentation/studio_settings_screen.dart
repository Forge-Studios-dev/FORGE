import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/studio_repository.dart';

final studioMeProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(studioRepositoryProvider).getMe();
});

class StudioSettingsScreen extends ConsumerWidget {
  const StudioSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meAsync = ref.watch(studioMeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Studio settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: meAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load profile')),
        data: (me) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            ForgeCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _row(context, 'Display name', me['displayName'] as String? ?? '—'),
                  const SizedBox(height: 12),
                  _row(context, 'Username', '@${me['username'] ?? '—'}'),
                  const SizedBox(height: 12),
                  _row(context, 'Email', me['email'] as String? ?? '—'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            ForgeButton(
              label: 'Edit profile settings',
              onPressed: () => context.push('/profile/settings'),
            ),
            if ((me['username'] as String?)?.isNotEmpty == true) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => context.push('/profile/${me['username']}'),
                child: const Text('View public channel'),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              'Shortcuts',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
                color: ForgeTokens.of(context).outline,
              ),
            ),
            const SizedBox(height: 8),
            _shortcut(
              context,
              icon: Icons.palette_outlined,
              title: 'Customize channel',
              subtitle: 'Name, about, banner, avatar, and links',
              onTap: () => context.push('/studio/branding'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.campaign_outlined,
              title: 'Community posts',
              subtitle: 'Publish updates to your channel Community tab',
              onTap: () => context.push('/studio/channel-posts'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.playlist_play,
              title: 'Playlists',
              subtitle: 'Create and organize channel playlists',
              onTap: () => context.push('/playlists'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.notifications_active,
              title: 'Attention queue',
              subtitle: 'Comments, moderation, and processing failures',
              onTap: () => context.push('/studio/attention'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.payments_outlined,
              title: 'Earnings',
              subtitle: 'Memberships, Super Thanks, and Super Chat summary',
              onTap: () => context.push('/studio/earnings'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.volunteer_activism,
              title: 'Super Thanks',
              subtitle: 'Review tips from viewers and export CSV',
              onTap: () => context.push('/studio/super-thanks'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.workspace_premium,
              title: 'Memberships',
              subtitle: 'Configure tiers and entitlements',
              onTap: () => context.push('/studio/tiers'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.shield_outlined,
              title: 'Moderation',
              subtitle: 'Reports, bans, and community trust tools',
              onTap: () => context.push('/studio/moderation'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.chat_outlined,
              title: 'Direct messages',
              subtitle: 'Reply to member conversations',
              onTap: () => context.push('/messages'),
            ),
            const SizedBox(height: 10),
            _shortcut(
              context,
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              subtitle: 'Creator alerts for comments and live events',
              onTap: () => context.push('/notifications'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _shortcut(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ForgeCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: ForgeTokens.of(context).primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: ForgeTokens.of(context).onSurface,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 13,
                    color: ForgeTokens.of(context).onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).outline)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
      ],
    );
  }
}
