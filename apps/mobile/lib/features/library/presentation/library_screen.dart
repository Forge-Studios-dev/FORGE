import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Library')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Your learning',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: ForgeTokens.onSurface,
                ),
          ),
          const SizedBox(height: 4),
          const Text(
            'History, notifications, and creator tools',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          ForgeCard(
            onTap: () => context.push('/history'),
            child: const _LibraryRow(
              icon: Icons.history,
              title: 'Watch history',
              subtitle: 'Lessons you have started',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/notifications'),
            child: const _LibraryRow(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              subtitle: 'Creator and upload updates',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/playlists'),
            child: const _LibraryRow(
              icon: Icons.playlist_play,
              title: 'Playlists',
              subtitle: 'Lessons you have saved and organized',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/updates'),
            child: const _LibraryRow(
              icon: Icons.campaign_outlined,
              title: 'Updates',
              subtitle: 'Announcements from communities you joined',
            ),
          ),
          const SizedBox(height: 12),
          ForgeCard(
            onTap: () => context.push('/studio'),
            child: const _LibraryRow(
              icon: Icons.video_camera_front_outlined,
              title: 'Creator Studio',
              subtitle: 'Manage videos and analytics',
            ),
          ),
        ],
      ),
    );
  }
}

class _LibraryRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _LibraryRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: ForgeTokens.primary, size: 28),
        const SizedBox(width: 16),
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
              const SizedBox(height: 2),
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
    );
  }
}
