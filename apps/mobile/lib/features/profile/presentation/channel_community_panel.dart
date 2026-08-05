import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

final channelPostsProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get(
    '/creators/$creatorId/channel-posts',
    queryParameters: {'limit': 20},
  );
  final root = res.data['data'];
  final list = root is Map ? root['data'] : root;
  if (list is! List) return [];
  return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
});

/// YouTube-style channel Community tab: posts feed + owner compose + like.
class ChannelCommunityPanel extends ConsumerStatefulWidget {
  const ChannelCommunityPanel({
    super.key,
    required this.creatorId,
    required this.isOwner,
  });

  final String creatorId;
  final bool isOwner;

  @override
  ConsumerState<ChannelCommunityPanel> createState() => _ChannelCommunityPanelState();
}

class _ChannelCommunityPanelState extends ConsumerState<ChannelCommunityPanel> {
  final _composeCtrl = TextEditingController();
  bool _posting = false;
  bool _uploading = false;
  String? _composeMsg;
  final List<String> _mediaUrls = [];
  final Set<String> _likeBusy = {};

  static const _maxImages = 4;

  @override
  void dispose() {
    _composeCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    if (_mediaUrls.length >= _maxImages) return;
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: true,
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    setState(() {
      _uploading = true;
      _composeMsg = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final remaining = _maxImages - _mediaUrls.length;
      for (final file in result.files.take(remaining)) {
        final path = file.path;
        if (path == null) continue;
        final name = file.name.toLowerCase();
        final contentType = name.endsWith('.png')
            ? 'image/png'
            : name.endsWith('.webp')
                ? 'image/webp'
                : 'image/jpeg';
        final presign = await client.dio.post(
          '/creators/me/channel-posts/media-upload-url',
          queryParameters: {'contentType': contentType},
        );
        final data = presign.data['data'] as Map<String, dynamic>;
        final uploadUrl = data['uploadUrl'] as String;
        final publicUrl = data['publicUrl'] as String;
        final put = await Dio().put(
          uploadUrl,
          data: await File(path).readAsBytes(),
          options: Options(
            headers: {'Content-Type': contentType},
            sendTimeout: const Duration(minutes: 2),
            receiveTimeout: const Duration(minutes: 2),
          ),
        );
        if (put.statusCode == null || put.statusCode! < 200 || put.statusCode! >= 300) {
          throw StateError('Upload failed');
        }
        _mediaUrls.add(publicUrl);
      }
      if (mounted) setState(() {});
    } catch (_) {
      if (!mounted) return;
      setState(() => _composeMsg = 'Could not upload image.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _publish() async {
    final text = _composeCtrl.text.trim();
    if (text.isEmpty && _mediaUrls.isEmpty) {
      setState(() => _composeMsg = 'Write something or add an image to post.');
      return;
    }
    setState(() {
      _posting = true;
      _composeMsg = null;
    });
    try {
      await ref.read(apiClientProvider).dio.post('/creators/me/channel-posts', data: {
        if (text.isNotEmpty) 'body': text,
        if (text.isEmpty) 'body': ' ',
        if (_mediaUrls.isNotEmpty) 'mediaUrls': List<String>.from(_mediaUrls),
      });
      _composeCtrl.clear();
      _mediaUrls.clear();
      ref.invalidate(channelPostsProvider(widget.creatorId));
      if (!mounted) return;
      setState(() => _composeMsg = 'Posted.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _composeMsg = 'Could not publish post.');
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _toggleLike(Map<String, dynamic> post) async {
    final id = post['id'] as String?;
    final communityId = post['communityId'] as String?;
    if (id == null || communityId == null || _likeBusy.contains(id)) return;
    setState(() => _likeBusy.add(id));
    try {
      await ref.read(apiClientProvider).dio.post(
            '/communities/$communityId/posts/$id/reactions',
          );
      ref.invalidate(channelPostsProvider(widget.creatorId));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to like posts')),
      );
    } finally {
      if (mounted) setState(() => _likeBusy.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final postsAsync = ref.watch(channelPostsProvider(widget.creatorId));
    final t = ForgeTokens.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.isOwner) ...[
          ForgeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Create a post',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: t.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _composeCtrl,
                  maxLines: 3,
                  maxLength: 4000,
                  decoration: const InputDecoration(
                    hintText: 'Share an update with your subscribers…',
                    border: OutlineInputBorder(),
                  ),
                ),
                if (_mediaUrls.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 72,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _mediaUrls.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: CachedNetworkImage(
                              imageUrl: _mediaUrls[i],
                              width: 72,
                              height: 72,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: IconButton(
                              iconSize: 16,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                              onPressed: () => setState(() => _mediaUrls.removeAt(i)),
                              icon: Icon(Icons.close, color: t.onSurface),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    TextButton.icon(
                      onPressed: _posting || _uploading || _mediaUrls.length >= _maxImages
                          ? null
                          : _pickImages,
                      icon: const Icon(Icons.image_outlined, size: 18),
                      label: Text(_uploading ? 'Uploading…' : 'Add image'),
                    ),
                    const Spacer(),
                    FilledButton(
                      onPressed: _posting || _uploading ? null : _publish,
                      child: Text(_posting ? 'Posting…' : 'Post'),
                    ),
                  ],
                ),
                if (_composeMsg != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(_composeMsg!, style: TextStyle(fontSize: 13, color: t.onSurfaceVariant)),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
        postsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => Text(
            'Could not load community posts.',
            style: TextStyle(color: t.onSurfaceVariant),
          ),
          data: (posts) {
            if (posts.isEmpty) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'No community posts yet.',
                    style: TextStyle(color: t.onSurfaceVariant),
                  ),
                  TextButton(
                    onPressed: () => context.push('/community/${widget.creatorId}'),
                    child: const Text('Open community'),
                  ),
                ],
              );
            }
            return Column(
              children: [
                for (final post in posts) ...[
                  _PostCard(
                    post: post,
                    likeBusy: _likeBusy.contains(post['id']),
                    onLike: () => _toggleLike(post),
                  ),
                  const SizedBox(height: 10),
                ],
                TextButton(
                  onPressed: () => context.push('/community/${widget.creatorId}'),
                  child: const Text('Open full community'),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.post,
    required this.onLike,
    required this.likeBusy,
  });

  final Map<String, dynamic> post;
  final VoidCallback onLike;
  final bool likeBusy;

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final author = post['author'] as Map<String, dynamic>?;
    final body = post['body'] as String? ?? '';
    final title = post['title'] as String?;
    final pinned = post['isPinned'] == true;
    final liked = post['likedByMe'] == true;
    final likeCount = (post['likeCount'] as num?)?.toInt() ?? 0;
    final commentCount = (post['commentCount'] as num?)?.toInt() ?? 0;
    final media = (post['mediaUrls'] as List?)?.whereType<String>().toList() ?? const [];
    final createdRaw = post['createdAt'] as String?;
    final created = createdRaw != null ? DateTime.tryParse(createdRaw)?.toLocal() : null;

    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pinned)
            Text(
              'Pinned',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: t.onSurfaceVariant),
            ),
          Text(
            author?['displayName'] as String? ??
                (author?['username'] != null ? '@${author!['username']}' : 'Creator'),
            style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
          ),
          if (created != null)
            Text(
              '${created.year}-${created.month.toString().padLeft(2, '0')}-${created.day.toString().padLeft(2, '0')}',
              style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
            ),
          if (title != null && title.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(title, style: TextStyle(fontWeight: FontWeight.w600)),
          ],
          if (body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(body, style: TextStyle(height: 1.4, color: t.onSurface)),
          ],
          if (media.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              height: 120,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: media.length.clamp(0, 4),
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: CachedNetworkImage(
                    imageUrl: media[i],
                    width: 160,
                    height: 120,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton.icon(
                onPressed: likeBusy ? null : onLike,
                icon: Icon(
                  liked ? Icons.thumb_up : Icons.thumb_up_outlined,
                  size: 18,
                ),
                label: Text(likeCount > 0 ? '$likeCount' : 'Like'),
              ),
              if (commentCount > 0)
                Text(
                  '$commentCount ${commentCount == 1 ? 'comment' : 'comments'}',
                  style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
