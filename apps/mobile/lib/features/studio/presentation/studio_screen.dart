import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class StudioScreen extends StatelessWidget {
  const StudioScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Creator Studio')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Upload, teach live, and grow your audience',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant),
          ),
          const SizedBox(height: 16),
          ForgeButton(label: 'Upload lesson', onPressed: () => context.push('/upload')),
          const SizedBox(height: 24),
          _zoneLabel('Content'),
          _link(context, 'Videos', 'Manage uploads', Icons.video_library, '/studio/videos'),
          _link(context, 'Courses', 'Lessons & multi-course programs', Icons.school, '/studio/courses'),
          _link(context, 'Go live', 'Start a session', Icons.sensors, '/studio/live'),
          _link(context, 'Comments', 'Community feedback', Icons.forum, '/studio/comments'),
          _zoneLabel('Community'),
          _link(context, 'Community', 'Rooms, members & moderation', Icons.groups, '/studio/communities'),
          _link(context, 'Brands', 'Organize communities', Icons.branding_watermark, '/studio/brands'),
          _zoneLabel('Grow'),
          _link(context, 'Analytics', 'Performance insights', Icons.analytics, '/studio/analytics'),
          _link(context, 'Memberships', 'Configure tiers', Icons.workspace_premium, '/studio/tiers'),
          _link(context, 'Subscribers', 'Manage members', Icons.people, '/studio/subscribers'),
          _link(context, 'Bundles', 'Package tier resources', Icons.inventory_2, '/studio/bundles'),
          _zoneLabel('Settings'),
          _link(context, 'AI Copilot', 'Personalized growth insights', Icons.psychology, '/studio/copilot'),
          _link(context, 'Settings', 'Channel preferences', Icons.settings, '/studio/settings'),
          _zoneLabel('Discover'),
          _link(context, 'Discover', 'Find communities', Icons.explore, '/discover/communities'),
          _link(context, 'Learn', 'Discover courses', Icons.menu_book, '/discover/courses'),
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
