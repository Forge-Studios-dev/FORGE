import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import 'studio_attention_screen.dart';

class StudioScreen extends ConsumerWidget {
  const StudioScreen({super.key});

  void _openCreateSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: ForgeTokens.of(context).outline,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Create',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: ForgeTokens.of(context).onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Pick what you want to publish next.',
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                _sheetAction(
                  sheetContext,
                  icon: Icons.upload,
                  title: 'Upload video',
                  subtitle: 'Start a new upload',
                  route: '/upload',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.sensors,
                  title: 'Go live',
                  subtitle: 'Start or schedule a stream',
                  route: '/studio/live',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.video_library,
                  title: 'Content',
                  subtitle: 'Manage your videos',
                  route: '/studio/videos',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.forum,
                  title: 'Comments',
                  subtitle: 'Reply to viewers',
                  route: '/studio/comments',
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetAction(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required String route,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: ForgeCard(
        onTap: () {
          Navigator.of(context).pop();
          context.push(route);
        },
        child: Row(
          children: [
            Icon(icon, color: ForgeTokens.of(context).primary),
            const SizedBox(width: 14),
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
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attentionAsync = ref.watch(studioAttentionProvider);
    final totalUrgent = attentionAsync.maybeWhen(
      data: (a) {
        final c = a.counts;
        return (c['commentsNeedingReply'] ?? 0) +
            (c['pendingModeration'] ?? 0) +
            (c['failedPayments'] ?? 0) +
            (c['processingFailures'] ?? 0);
      },
      orElse: () => 0,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Creator Studio')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreateSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('Create'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        children: [
          Text(
            'Command center',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
              color: ForgeTokens.of(context).outline,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Publish, go live, and keep up with what needs attention.',
            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, height: 1.4),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ForgeButton(
                  label: 'Upload',
                  onPressed: () => context.push('/upload'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ForgeButton(
                  label: 'Go live',
                  primary: false,
                  onPressed: () => context.push('/studio/live'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ForgeCard(
            onTap: () => context.push('/studio/attention'),
            child: Row(
              children: [
                Icon(Icons.notifications_active, color: ForgeTokens.of(context).tertiary),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            'Attention',
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: ForgeTokens.of(context).onSurface,
                            ),
                          ),
                          if (totalUrgent > 0) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: ForgeTokens.of(context).error,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                totalUrgent > 99 ? '99+' : '$totalUrgent',
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
                      Text(
                        totalUrgent > 0
                            ? 'Items need your review'
                            : 'Comments, moderation, and processing',
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
          const SizedBox(height: 24),
          _zoneLabel(context, 'Content'),
          _link(context, 'Videos', 'Manage uploads', Icons.video_library, '/studio/videos'),
          _link(context, 'Playlists', 'Organize channel playlists', Icons.playlist_play, '/playlists'),
          _link(context, 'Community posts', 'Post to your channel Community tab', Icons.campaign_outlined, '/studio/channel-posts'),
          _link(context, 'Go live', 'Start a stream', Icons.sensors, '/studio/live'),
          _link(context, 'Comments', 'Reply to viewers', Icons.forum, '/studio/comments'),
          _link(context, 'Attention', 'Unified action queue', Icons.notifications_active, '/studio/attention'),
          _link(context, 'Messages', 'Direct messages', Icons.chat, '/messages'),
          _zoneLabel(context, 'Audience'),
          _link(context, 'Moderation', 'Reports & trust queue', Icons.shield, '/studio/moderation'),
          _zoneLabel(context, 'Grow'),
          _link(context, 'Analytics', 'Performance insights', Icons.analytics, '/studio/analytics'),
          _link(context, 'Super Thanks', 'Tips from viewers', Icons.volunteer_activism, '/studio/super-thanks'),
          _link(context, 'Memberships', 'Configure tiers', Icons.workspace_premium, '/studio/tiers'),
          _link(context, 'Members', 'Manage channel memberships', Icons.people, '/studio/subscribers'),
          _zoneLabel(context, 'Channel'),
          _link(context, 'Customize channel', 'Name, about, banner & links', Icons.palette_outlined, '/studio/branding'),
          _link(context, 'Settings', 'Customization', Icons.settings, '/studio/settings'),
        ],
      ),
    );
  }

  Widget _zoneLabel(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
          color: ForgeTokens.of(context).outline,
        ),
      ),
    );
  }

  Widget _link(BuildContext context, String title, String sub, IconData icon, String route) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ForgeCard(
        onTap: () => context.push(route),
        child: Row(
          children: [
            Icon(icon, color: ForgeTokens.of(context).primary),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.of(context).onSurface)),
                  Text(sub, style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant)),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
          ],
        ),
      ),
    );
  }
}
