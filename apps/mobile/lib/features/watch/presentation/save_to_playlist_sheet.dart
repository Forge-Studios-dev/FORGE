import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../playlists/presentation/create_playlist_dialog.dart';
import '../data/watch_repository.dart';

/// YouTube-style Save to playlist sheet (list / toggle / create).
Future<void> showSaveToPlaylistSheet({
  required BuildContext context,
  required WidgetRef ref,
  required String videoId,
}) async {
  final repo = ref.read(watchRepositoryProvider);
  List<Map<String, dynamic>> playlists = [];
  Set<String> selected = {};
  try {
    final results = await Future.wait([
      repo.listMyPlaylists(),
      repo.playlistsContaining(videoId),
    ]);
    playlists = (results[0] as List<Map<String, dynamic>>)
        .where((p) => p['systemType'] != 'liked')
        .toList();
    selected = Set<String>.from(results[1] as Set<String>);
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to save to playlists')),
      );
    }
    return;
  }
  if (!context.mounted) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setModal) {
          Future<void> toggle(String playlistId, bool next) async {
            setModal(() {
              if (next) {
                selected.add(playlistId);
              } else {
                selected.remove(playlistId);
              }
            });
            try {
              if (next) {
                await repo.addVideoToPlaylist(playlistId: playlistId, videoId: videoId);
              } else {
                await repo.removeVideoFromPlaylist(playlistId: playlistId, videoId: videoId);
              }
            } catch (_) {
              setModal(() {
                if (next) {
                  selected.remove(playlistId);
                } else {
                  selected.add(playlistId);
                }
              });
              if (ctx.mounted) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Could not update playlist')),
                );
              }
            }
          }

          Future<void> createNew() async {
            final id = await showCreatePlaylistDialog(ctx, ref);
            if (id == null) return;
            try {
              await repo.addVideoToPlaylist(playlistId: id, videoId: videoId);
              Map<String, dynamic> created = {'id': id, 'title': 'Playlist'};
              try {
                final list = await repo.listMyPlaylists();
                created = list.firstWhere(
                  (p) => p['id'] == id,
                  orElse: () => created,
                );
              } catch (_) {}
              setModal(() {
                playlists = [created, ...playlists.where((p) => p['id'] != id)];
                selected.add(id);
              });
            } catch (_) {
              if (ctx.mounted) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Could not save to new playlist')),
                );
              }
            }
          }

          return SafeArea(
            child: Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Save to playlist', style: Theme.of(ctx).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxHeight: MediaQuery.sizeOf(ctx).height * 0.45,
                    ),
                    child: playlists.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Text('No playlists yet. Create one below.'),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            itemCount: playlists.length,
                            itemBuilder: (_, i) {
                              final p = playlists[i];
                              final id = p['id'] as String? ?? '';
                              final title = p['title'] as String? ?? 'Playlist';
                              final checked = selected.contains(id);
                              return CheckboxListTile(
                                value: checked,
                                title: Text(title),
                                onChanged: id.isEmpty ? null : (v) => toggle(id, v ?? false),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: createNew,
                    icon: const Icon(Icons.add),
                    label: const Text('New playlist'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Done'),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}
