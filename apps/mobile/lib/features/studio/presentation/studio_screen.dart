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
          _link(context, 'Videos', 'Manage uploads', Icons.video_library, '/studio/videos'),
          _link(context, 'Comments', 'Community feedback', Icons.forum, '/studio/comments'),
          _link(context, 'Go live', 'Start a session', Icons.sensors, '/studio/live'),
          _link(context, 'Memberships', 'Configure tiers', Icons.workspace_premium, '/studio/tiers'),
          _link(context, 'Subscribers', 'Manage members', Icons.people, '/studio/subscribers'),
          _link(context, 'Community', 'Manage channels', Icons.groups, '/studio/community'),
          _link(context, 'Analytics', 'Performance insights', Icons.analytics, '/studio/analytics'),
          _link(context, 'Settings', 'Channel preferences', Icons.settings, '/studio/settings'),
        ],
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
