import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioScreen extends StatelessWidget {
  const StudioScreen({super.key});

  void _openAttentionSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ForgeTokens.surfaceContainerHigh,
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
                      color: ForgeTokens.outline,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Attention',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: ForgeTokens.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Jump to the inbox that needs you next.',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                _sheetAction(
                  sheetContext,
                  icon: Icons.forum,
                  title: 'Comments',
                  subtitle: 'Reply to learners',
                  route: '/studio/comments',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.shield,
                  title: 'Moderation',
                  subtitle: 'Open reports and trust queue',
                  route: '/studio/moderation',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.groups,
                  title: 'Subscribers',
                  subtitle: 'Failed payments and member issues',
                  route: '/studio/subscribers',
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _openCreateSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: ForgeTokens.surfaceContainerHigh,
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
                      color: ForgeTokens.outline,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Create',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: ForgeTokens.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Pick what you want to publish next.',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                _sheetAction(
                  sheetContext,
                  icon: Icons.upload,
                  title: 'Upload video',
                  subtitle: 'Start a new lesson upload',
                  route: '/upload',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.sensors,
                  title: 'Go live',
                  subtitle: 'Start or schedule a session',
                  route: '/studio/live',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.school,
                  title: 'Courses',
                  subtitle: 'Manage courses and programs',
                  route: '/studio/courses',
                ),
                _sheetAction(
                  sheetContext,
                  icon: Icons.forum,
                  title: 'Comments',
                  subtitle: 'Reply to learner feedback',
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
            Icon(icon, color: ForgeTokens.primary),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      color: ForgeTokens.onSurface,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 13,
                      color: ForgeTokens.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: ForgeTokens.outline),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
          const Text(
            'Command center',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.1,
              color: ForgeTokens.outline,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Publish, go live, and keep up with what needs attention.',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant, height: 1.4),
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
            onTap: () => _openAttentionSheet(context),
            child: const Row(
              children: [
                Icon(Icons.notifications_active, color: ForgeTokens.tertiary),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Attention',
                        style: TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.onSurface),
                      ),
                      Text(
                        'Comments, moderation, and member issues',
                        style: TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: ForgeTokens.outline),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _zoneLabel('Content'),
          _link(context, 'Videos', 'Manage uploads', Icons.video_library, '/studio/videos'),
          _link(context, 'Courses', 'Lessons & programs', Icons.school, '/studio/courses'),
          _link(context, 'Go live', 'Start a session', Icons.sensors, '/studio/live'),
          _link(context, 'Comments', 'Reply to learners', Icons.forum, '/studio/comments'),
          _link(context, 'Messages', 'Member conversations', Icons.chat, '/messages'),
          _zoneLabel('Community'),
          _link(context, 'Communities', 'Rooms, members & health', Icons.groups, '/studio/community'),
          _link(context, 'Moderation', 'Reports & trust queue', Icons.shield, '/studio/moderation'),
          _link(context, 'Brands', 'Organize communities', Icons.branding_watermark, '/studio/brands'),
          _zoneLabel('Grow'),
          _link(context, 'Analytics', 'Performance insights', Icons.analytics, '/studio/analytics'),
          _link(context, 'Memberships', 'Configure tiers', Icons.workspace_premium, '/studio/tiers'),
          _link(context, 'Channel points', 'Rewards & redemptions', Icons.stars, '/studio/channel-points'),
          _link(context, 'Mentorship', 'Match mentors & mentees', Icons.handshake, '/studio/mentorship'),
          _link(context, 'Subscribers', 'Manage members', Icons.people, '/studio/subscribers'),
          _link(context, 'Bundles', 'Package tier resources', Icons.inventory_2, '/studio/bundles'),
          _link(context, 'Engagement', 'Gamification & health', Icons.insights, '/studio/engagement'),
          _link(context, 'AI Copilot', 'Growth insights', Icons.psychology, '/studio/copilot'),
          _zoneLabel('Settings'),
          _link(context, 'Settings', 'Channel preferences', Icons.settings, '/studio/settings'),
        ],
      ),
    );
  }

  Widget _zoneLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
          color: ForgeTokens.outline,
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
            Icon(icon, color: ForgeTokens.primary),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: ForgeTokens.onSurface)),
                  Text(sub, style: const TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: ForgeTokens.outline),
          ],
        ),
      ),
    );
  }
}
