import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';
import 'watch_screen.dart';

class PlaylistQueueSection extends StatelessWidget {
  final Map<String, dynamic> playlist;
  final String listId;
  final String currentVideoId;
  final bool shuffle;
  const PlaylistQueueSection({
    required this.playlist,
    required this.listId,
    required this.currentVideoId,
    required this.shuffle,
  });

  @override
  Widget build(BuildContext context) {
    final items = (playlist['items'] as List?) ?? [];
    final title = playlist['title'] as String? ?? 'Playlist';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Playlist', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          '$title · ${items.length} videos${shuffle ? ' · Shuffle on' : ''}',
          style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13),
        ),
        const SizedBox(height: 8),
        ...items.asMap().entries.map((entry) {
          final i = entry.key;
          final item = entry.value as Map<String, dynamic>;
          final video = item['video'] as Map<String, dynamic>?;
          final videoId = item['videoId'] as String? ?? video?['id'] as String?;
          final active = videoId == currentVideoId;
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: ForgeCard(
              onTap: videoId == null
                  ? null
                  : () => context.push(
                        watchListHref(videoId, playlistId: listId, shuffle: shuffle),
                      ),
              child: Row(
                children: [
                  SizedBox(
                    width: 24,
                    child: Text(
                      '${i + 1}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: active ? ForgeTokens.of(context).primary : ForgeTokens.of(context).outline,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      video?['title'] as String? ?? 'Video',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: ForgeTokens.of(context).onSurface,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ),
                  if (active)
                    Icon(Icons.play_arrow, size: 18, color: ForgeTokens.of(context).primary),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}
