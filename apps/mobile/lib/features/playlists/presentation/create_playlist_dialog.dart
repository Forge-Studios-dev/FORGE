import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// YouTube-style New playlist dialog (title, optional description, visibility).
/// Returns the created playlist id, or null if cancelled / failed.
Future<String?> showCreatePlaylistDialog(BuildContext context, WidgetRef ref) async {
  final titleCtrl = TextEditingController();
  final descCtrl = TextEditingController();
  var visibility = 'public';
  try {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('New playlist'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  autofocus: true,
                  maxLength: 200,
                  decoration: const InputDecoration(hintText: 'Playlist title'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descCtrl,
                  maxLength: 500,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'Description (optional)',
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Visibility'),
                    const Spacer(),
                    DropdownButton<String>(
                      value: visibility,
                      items: const [
                        DropdownMenuItem(value: 'public', child: Text('Public')),
                        DropdownMenuItem(value: 'unlisted', child: Text('Unlisted')),
                        DropdownMenuItem(value: 'private', child: Text('Private')),
                      ],
                      onChanged: (v) => setLocal(() => visibility = v ?? 'public'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
          ],
        ),
      ),
    );

    if (confirmed != true) return null;
    final title = titleCtrl.text.trim();
    if (title.isEmpty) return null;

    final description = descCtrl.text.trim();
    final api = ref.read(apiClientProvider);
    final res = await api.dio.post(
      '/playlists',
      data: {
        'title': title,
        'visibility': visibility,
        if (description.isNotEmpty) 'description': description,
      },
    );
    final data = res.data['data'];
    if (data is Map && data['id'] is String) return data['id'] as String;
    return null;
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not create playlist')),
      );
    }
    return null;
  } finally {
    titleCtrl.dispose();
    descCtrl.dispose();
  }
}
