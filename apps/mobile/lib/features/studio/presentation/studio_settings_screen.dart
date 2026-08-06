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
            ForgeCard(
              onTap: () => context.push('/studio/branding'),
              child: Row(
                children: [
                  Icon(Icons.palette_outlined, color: ForgeTokens.of(context).primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Customize channel',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        Text(
                          'Name, about, banner, avatar, and links',
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
            ),
            const SizedBox(height: 10),
            ForgeCard(
              onTap: () => context.push('/playlists'),
              child: Row(
                children: [
                  Icon(Icons.playlist_play, color: ForgeTokens.of(context).primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Playlists',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        Text(
                          'Create and organize channel playlists',
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
            ),
            const SizedBox(height: 10),
            ForgeCard(
              onTap: () => context.push('/studio/attention'),
              child: Row(
                children: [
                  Icon(Icons.notifications_active, color: ForgeTokens.of(context).primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Attention queue',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        Text(
                          'Comments, moderation, and processing failures',
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
            ),
            const SizedBox(height: 10),
            ForgeCard(
              onTap: () => context.push('/studio/tiers'),
              child: Row(
                children: [
                  Icon(Icons.workspace_premium, color: ForgeTokens.of(context).primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Memberships',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        Text(
                          'Configure tiers and entitlements',
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
            ),
            const SizedBox(height: 10),
            ForgeCard(
              onTap: () => context.push('/notifications'),
              child: Row(
                children: [
                  Icon(Icons.notifications_outlined, color: ForgeTokens.of(context).primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Notifications',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: ForgeTokens.of(context).onSurface,
                          ),
                        ),
                        Text(
                          'Creator alerts for comments and live events',
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
            ),
          ],
        ),
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
