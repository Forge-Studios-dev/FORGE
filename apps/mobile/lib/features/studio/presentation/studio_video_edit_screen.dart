import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/description_chapters_hint.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../../watch/data/watch_repository.dart';
import '../data/studio_repository.dart';

const _visibilityOptions = <({String value, String label})>[
  (value: 'public', label: 'Public'),
  (value: 'unlisted', label: 'Unlisted'),
  (value: 'private', label: 'Private'),
  (value: 'followers', label: 'Subscribers only'),
  (value: 'subscribers', label: 'Members only'),
];

const _captionLanguages = <({String code, String label})>[
  (code: 'en', label: 'English'),
  (code: 'es', label: 'Spanish'),
  (code: 'hi', label: 'Hindi'),
  (code: 'pt', label: 'Portuguese'),
  (code: 'fr', label: 'French'),
  (code: 'de', label: 'German'),
  (code: 'ja', label: 'Japanese'),
  (code: 'ko', label: 'Korean'),
  (code: 'ar', label: 'Arabic'),
];

final studioVideoProvider =
    FutureProvider.autoDispose.family<VideoModel, String>((ref, videoId) {
  return ref.read(studioRepositoryProvider).getStudioVideo(videoId);
});

class StudioVideoEditScreen extends ConsumerStatefulWidget {
  const StudioVideoEditScreen({super.key, required this.videoId});

  final String videoId;

  @override
  ConsumerState<StudioVideoEditScreen> createState() => _StudioVideoEditScreenState();
}

class _StudioVideoEditScreenState extends ConsumerState<StudioVideoEditScreen> {
  final _titleCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  String _visibility = 'public';
  String _videoType = 'video';
  bool _scheduleEnabled = false;
  DateTime? _scheduledAt;
  String _captionLang = 'en';
  bool _hydrated = false;
  bool _saving = false;
  bool _busy = false;
  bool _captionBusy = false;
  bool _thumbBusy = false;
  String? _error;
  String? _savedMsg;
  String? _captionMsg;
  String? _thumbMsg;
  String? _categoryId;
  final Set<String> _skillTagIds = {};
  List<Map<String, dynamic>> _availableTags = [];
  bool _tagsLoading = false;
  List<Map<String, dynamic>> _myPlaylists = [];
  final Set<String> _playlistIds = {};
  bool _playlistsLoading = false;
  bool _playlistBusy = false;
  String? _playlistMsg;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  void _hydrate(VideoModel video) {
    if (_hydrated) return;
    _titleCtrl.text = video.title;
    _descriptionCtrl.text = video.description ?? '';
    _visibility = video.visibility ?? 'public';
    _videoType = video.videoType == 'short' ? 'short' : 'video';
    final scheduled = video.scheduledPublishAt;
    if (scheduled != null && scheduled.isAfter(DateTime.now())) {
      _scheduleEnabled = true;
      _scheduledAt = scheduled.toLocal();
    }
    _categoryId = video.categoryId;
    _skillTagIds
      ..clear()
      ..addAll(video.skillTags.map((t) => t.id));
    _hydrated = true;
    if (_categoryId != null) {
      unawaited(_loadTags(_categoryId!));
    }
    unawaited(_loadPlaylists());
  }

  Future<void> _loadPlaylists() async {
    setState(() => _playlistsLoading = true);
    try {
      final repo = ref.read(watchRepositoryProvider);
      final playlists = await repo.listMyPlaylists();
      final containing = await repo.playlistsContaining(widget.videoId);
      if (!mounted) return;
      setState(() {
        _myPlaylists = playlists
            .where((p) => p['systemType'] == null && p['id'] is String)
            .toList();
        _playlistIds
          ..clear()
          ..addAll(containing);
        _playlistsLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _myPlaylists = [];
          _playlistsLoading = false;
        });
      }
    }
  }

  Future<void> _togglePlaylist(String playlistId, bool next) async {
    if (_playlistBusy) return;
    setState(() {
      _playlistBusy = true;
      _playlistMsg = null;
      if (next) {
        _playlistIds.add(playlistId);
      } else {
        _playlistIds.remove(playlistId);
      }
    });
    try {
      final repo = ref.read(watchRepositoryProvider);
      if (next) {
        await repo.addVideoToPlaylist(playlistId: playlistId, videoId: widget.videoId);
      } else {
        await repo.removeVideoFromPlaylist(playlistId: playlistId, videoId: widget.videoId);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (next) {
          _playlistIds.remove(playlistId);
        } else {
          _playlistIds.add(playlistId);
        }
        _playlistMsg = 'Could not update playlist.';
      });
    } finally {
      if (mounted) setState(() => _playlistBusy = false);
    }
  }

  Future<void> _loadTags(String categoryId) async {
    setState(() => _tagsLoading = true);
    try {
      final cats = await ref.read(studioRepositoryProvider).getUploadCategoryOptions();
      final match = cats.firstWhere(
        (c) => c['id'] == categoryId,
        orElse: () => const <String, dynamic>{},
      );
      final tags = (match['skillTags'] as List?)?.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() ??
          [];
      if (!mounted) return;
      setState(() {
        _availableTags = tags;
        _tagsLoading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _availableTags = [];
          _tagsLoading = false;
        });
      }
    }
  }

  Future<void> _pickSchedule() async {
    final now = DateTime.now();
    final initial = _scheduledAt ?? now.add(const Duration(hours: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(now) ? now.add(const Duration(days: 1)) : initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;
    final picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    if (picked.isBefore(now.add(const Duration(minutes: 15)))) {
      setState(() => _error = 'Schedule at least 15 minutes from now.');
      return;
    }
    setState(() {
      _scheduledAt = picked;
      _scheduleEnabled = true;
      _error = null;
    });
  }

  Future<void> _publishNow() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _savedMsg = null;
      _scheduleEnabled = false;
      _scheduledAt = null;
    });
    try {
      await ref.read(studioRepositoryProvider).updateVideo(
            widget.videoId,
            title: title,
            description: _descriptionCtrl.text,
            visibility: _visibility,
            videoType: _videoType,
            scheduledPublishAt: null,
            skillTagIds: _categoryId != null && _availableTags.isNotEmpty ? _skillTagIds.toList() : null,
          );
      _hydrated = false;
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      setState(() => _savedMsg = 'Published now');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not publish now.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _cancelSchedule() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _savedMsg = null;
      _scheduleEnabled = false;
      _scheduledAt = null;
      _visibility = 'private';
    });
    try {
      await ref.read(studioRepositoryProvider).updateVideo(
            widget.videoId,
            title: title,
            description: _descriptionCtrl.text,
            visibility: 'private',
            videoType: _videoType,
            scheduledPublishAt: null,
            skillTagIds: _categoryId != null && _availableTags.isNotEmpty ? _skillTagIds.toList() : null,
          );
      _hydrated = false;
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      setState(() => _savedMsg = 'Schedule cancelled — video is private');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not cancel schedule.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _save() async {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    if (_scheduleEnabled) {
      final at = _scheduledAt;
      if (at == null || at.isBefore(DateTime.now().add(const Duration(minutes: 15)))) {
        setState(() => _error = 'Pick a publish time at least 15 minutes from now.');
        return;
      }
    }
    setState(() {
      _saving = true;
      _error = null;
      _savedMsg = null;
    });
    try {
      await ref.read(studioRepositoryProvider).updateVideo(
            widget.videoId,
            title: title,
            description: _descriptionCtrl.text,
            visibility: _visibility,
            videoType: _videoType,
            scheduledPublishAt:
                _scheduleEnabled && _scheduledAt != null ? _scheduledAt!.toUtc().toIso8601String() : null,
            skillTagIds: _categoryId != null && _availableTags.isNotEmpty ? _skillTagIds.toList() : null,
          );
      _hydrated = false;
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      setState(() => _savedMsg = 'Saved');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not save video.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _cancelUpload() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel upload?'),
        content: const Text('This removes the incomplete or failed upload from Studio.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cancel upload')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studioRepositoryProvider).cancelUpload(widget.videoId);
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      context.go('/studio/videos');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not cancel upload.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _retry() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studioRepositoryProvider).retryTranscode(widget.videoId);
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not retry processing.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete video?'),
        content: const Text('This permanently removes the video. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(studioRepositoryProvider).deleteVideo(widget.videoId);
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      context.go('/studio/videos');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Could not delete video.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadThumbnail() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final path = file.path;
    if (path == null) return;
    final name = file.name.toLowerCase();
    final contentType = name.endsWith('.png')
        ? 'image/png'
        : name.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg';
    setState(() {
      _thumbBusy = true;
      _thumbMsg = null;
      _error = null;
    });
    try {
      await ref.read(studioRepositoryProvider).uploadThumbnail(
            videoId: widget.videoId,
            filePath: path,
            contentType: contentType,
          );
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      setState(() => _thumbMsg = 'Thumbnail updated.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _thumbMsg = 'Could not upload thumbnail.');
    } finally {
      if (mounted) setState(() => _thumbBusy = false);
    }
  }

  Future<void> _clearThumbnail() async {
    setState(() {
      _thumbBusy = true;
      _thumbMsg = null;
    });
    try {
      await ref.read(studioRepositoryProvider).clearThumbnail(widget.videoId);
      ref.invalidate(studioVideoProvider(widget.videoId));
      ref.invalidate(myVideosProvider);
      if (!mounted) return;
      setState(() => _thumbMsg = 'Custom thumbnail cleared.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _thumbMsg = 'Could not clear thumbnail.');
    } finally {
      if (mounted) setState(() => _thumbBusy = false);
    }
  }

  Future<void> _uploadCaption() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['vtt'],
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty) return;
    final path = result.files.single.path;
    final name = result.files.single.name.toLowerCase();
    if (path == null || !name.endsWith('.vtt')) {
      setState(() => _captionMsg = 'Please choose a .vtt WebVTT file.');
      return;
    }
    setState(() {
      _captionBusy = true;
      _captionMsg = null;
      _error = null;
    });
    try {
      await ref.read(studioRepositoryProvider).uploadCaption(
            videoId: widget.videoId,
            filePath: path,
            language: _captionLang,
          );
      ref.invalidate(studioVideoProvider(widget.videoId));
      if (!mounted) return;
      setState(() => _captionMsg = 'Captions uploaded ($_captionLang).');
    } catch (_) {
      if (!mounted) return;
      setState(() => _captionMsg = 'Could not upload captions.');
    } finally {
      if (mounted) setState(() => _captionBusy = false);
    }
  }

  Future<void> _clearCaption() async {
    setState(() {
      _captionBusy = true;
      _captionMsg = null;
    });
    try {
      await ref.read(studioRepositoryProvider).clearCaption(
            widget.videoId,
            language: _captionLang,
          );
      ref.invalidate(studioVideoProvider(widget.videoId));
      if (!mounted) return;
      setState(() => _captionMsg = 'Captions removed ($_captionLang).');
    } catch (_) {
      if (!mounted) return;
      setState(() => _captionMsg = 'Could not remove captions.');
    } finally {
      if (mounted) setState(() => _captionBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final videoAsync = ref.watch(studioVideoProvider(widget.videoId));
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit video'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio/videos'),
        ),
        actions: [
          ...videoAsync.maybeWhen(
            data: (v) => v.status == 'ready'
                ? [
                    IconButton(
                      tooltip: 'Watch',
                      icon: const Icon(Icons.play_circle_outline),
                      onPressed: () {
                        final path = v.videoType == 'short'
                            ? '/shorts?v=${widget.videoId}'
                            : '/watch/${widget.videoId}';
                        context.push(path);
                      },
                    ),
                  ]
                : const <Widget>[],
            orElse: () => const <Widget>[],
          ),
        ],
      ),
      body: videoAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Failed to load video', style: TextStyle(color: t.onSurfaceVariant)),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => ref.invalidate(studioVideoProvider(widget.videoId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (video) {
          _hydrate(video);
          final canCancel = video.status == 'uploading' ||
              video.status == 'processing' ||
              video.status == 'failed' ||
              video.status == 'pending';
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ForgeCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _statusLabel(video.status),
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: _statusColor(context, video.status),
                      ),
                    ),
                    if (video.scheduledPublishAt != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Scheduled ${video.scheduledPublishAt!.toLocal()}',
                        style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text(
                      '${video.viewCount} views · ${video.likeCount} likes',
                      style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                    ),
                    if (video.status == 'ready' ||
                        video.status == 'processing' ||
                        video.status == 'uploading') ...[
                      const SizedBox(height: 12),
                      if (video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: AspectRatio(
                            aspectRatio: 16 / 9,
                            child: Image.network(
                              video.thumbnailUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => ColoredBox(
                                color: t.surfaceContainerHigh,
                                child: Icon(Icons.broken_image_outlined, color: t.onSurfaceVariant),
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Text(
                        'Thumbnail',
                        style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        children: [
                          TextButton(
                            onPressed: _thumbBusy || _busy || _saving ? null : _uploadThumbnail,
                            child: Text(_thumbBusy ? 'Uploading…' : 'Change thumbnail'),
                          ),
                          if (video.thumbnailUrl != null && video.thumbnailUrl!.isNotEmpty)
                            TextButton(
                              onPressed: _thumbBusy || _busy || _saving ? null : _clearThumbnail,
                              child: const Text('Clear'),
                            ),
                        ],
                      ),
                      if (_thumbMsg != null)
                        Text(_thumbMsg!, style: TextStyle(fontSize: 13, color: t.onSurfaceVariant)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _titleCtrl,
                decoration: const InputDecoration(labelText: 'Title'),
                textCapitalization: TextCapitalization.sentences,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _descriptionCtrl,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  hintText: 'Add 0:00 Chapter title lines for chapters',
                ),
                minLines: 4,
                maxLines: 8,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
              ),
              if (_categoryId != null) ...[
                const SizedBox(height: 16),
                Text(
                  'Topic tags',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: ForgeTokens.of(context).onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                if (_tagsLoading)
                  Text(
                    'Loading tags…',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  )
                else if (_availableTags.isEmpty)
                  Text(
                    'No tags for this category.',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: _availableTags.map((tag) {
                      final id = tag['id'] as String? ?? '';
                      final selected = _skillTagIds.contains(id);
                      return FilterChip(
                        label: Text(tag['name'] as String? ?? ''),
                        selected: selected,
                        onSelected: _saving || _busy
                            ? null
                            : (on) => setState(() {
                                  if (on) {
                                    _skillTagIds.add(id);
                                  } else {
                                    _skillTagIds.remove(id);
                                  }
                                }),
                      );
                    }).toList(),
                  ),
              ],
              DescriptionChaptersHint(description: _descriptionCtrl.text),
              const SizedBox(height: 16),
              Text(
                'Playlists',
                style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
              ),
              const SizedBox(height: 4),
              Text(
                'Add or remove this video from your custom playlists.',
                style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
              ),
              const SizedBox(height: 8),
              if (_playlistsLoading)
                Text('Loading playlists…', style: TextStyle(color: t.onSurfaceVariant))
              else if (_myPlaylists.isEmpty)
                Text(
                  'No custom playlists yet. Create one from Library.',
                  style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                )
              else
                ..._myPlaylists.map((p) {
                  final id = p['id'] as String? ?? '';
                  final title = p['title'] as String? ?? 'Playlist';
                  final checked = _playlistIds.contains(id);
                  return CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: checked,
                    title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                    onChanged: _playlistBusy || id.isEmpty
                        ? null
                        : (on) => _togglePlaylist(id, on == true),
                  );
                }),
              if (_playlistMsg != null)
                Text(_playlistMsg!, style: TextStyle(fontSize: 13, color: t.error)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _visibilityOptions.any((o) => o.value == _visibility)
                    ? _visibility
                    : 'public',
                decoration: const InputDecoration(labelText: 'Visibility'),
                items: _visibilityOptions
                    .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                    .toList(),
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _visibility = value);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _videoType == 'short' ? 'short' : 'video',
                decoration: const InputDecoration(labelText: 'Type'),
                items: const [
                  DropdownMenuItem(value: 'video', child: Text('Video')),
                  DropdownMenuItem(value: 'short', child: Text('Short')),
                ],
                onChanged: (value) {
                  if (value == null) return;
                  setState(() => _videoType = value);
                },
              ),
              if (_videoType == 'short')
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Shorts must be 60 seconds or shorter.',
                    style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                  ),
                ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Schedule publish'),
                subtitle: Text(
                  _scheduleEnabled && _scheduledAt != null
                      ? _scheduledAt!.toLocal().toString()
                      : 'Publish immediately when processing finishes',
                  style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                ),
                value: _scheduleEnabled,
                onChanged: (on) {
                  setState(() {
                    _scheduleEnabled = on;
                    if (on && _scheduledAt == null) {
                      _scheduledAt = DateTime.now().add(const Duration(hours: 1));
                    }
                    if (!on) _error = null;
                  });
                  if (on) {
                    _pickSchedule();
                  }
                },
              ),
              if (_scheduleEnabled)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _pickSchedule,
                    icon: const Icon(Icons.event, size: 18),
                    label: const Text('Pick date & time'),
                  ),
                ),
              if (_scheduleEnabled ||
                  (video.scheduledPublishAt != null &&
                      video.scheduledPublishAt!.isAfter(DateTime.now())))
                Align(
                  alignment: Alignment.centerLeft,
                  child: Wrap(
                    spacing: 8,
                    children: [
                      TextButton(
                        onPressed: _saving || _busy ? null : _publishNow,
                        child: const Text('Publish now'),
                      ),
                      TextButton(
                        onPressed: _saving || _busy ? null : _cancelSchedule,
                        child: const Text('Cancel schedule'),
                      ),
                    ],
                  ),
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: TextStyle(color: t.error)),
              ],
              if (_savedMsg != null) ...[
                const SizedBox(height: 12),
                Text(_savedMsg!, style: TextStyle(color: t.secondary)),
              ],
              const SizedBox(height: 20),
              ForgeButton(
                label: _saving ? 'Saving…' : 'Save',
                onPressed: _saving || _busy ? null : _save,
              ),
              if (video.status == 'failed') ...[
                const SizedBox(height: 12),
                ForgeButton(
                  label: _busy ? 'Retrying…' : 'Retry processing',
                  onPressed: _busy || _saving ? null : _retry,
                  primary: false,
                ),
              ],
              if (canCancel) ...[
                const SizedBox(height: 12),
                ForgeButton(
                  label: 'Cancel upload',
                  onPressed: _busy || _saving ? null : _cancelUpload,
                  primary: false,
                ),
              ],
              if (video.status == 'ready') ...[
                const SizedBox(height: 24),
                Text('Captions', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
                const SizedBox(height: 8),
                if (video.captionTracks.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Tracks: ${video.captionTracks.map((c) => c.language).join(', ')}',
                      style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                    ),
                  ),
                DropdownButtonFormField<String>(
                  value: _captionLang,
                  decoration: const InputDecoration(labelText: 'Language'),
                  items: _captionLanguages
                      .map((o) => DropdownMenuItem(value: o.code, child: Text(o.label)))
                      .toList(),
                  onChanged: _captionBusy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() => _captionLang = value);
                        },
                ),
                const SizedBox(height: 12),
                ForgeButton(
                  label: _captionBusy ? 'Uploading…' : 'Upload .vtt captions',
                  onPressed: _captionBusy || _busy || _saving ? null : _uploadCaption,
                  primary: false,
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _captionBusy || _busy || _saving ? null : _clearCaption,
                  child: Text('Remove $_captionLang captions'),
                ),
                if (_captionMsg != null) ...[
                  const SizedBox(height: 8),
                  Text(_captionMsg!, style: TextStyle(color: t.onSurfaceVariant)),
                ],
                const SizedBox(height: 12),
                ForgeButton(
                  label: 'Delete video',
                  onPressed: _busy || _saving || _captionBusy ? null : _delete,
                  primary: false,
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      case 'failed':
        return 'Failed';
      case 'draft':
        return 'Draft';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  }

  Color _statusColor(BuildContext context, String status) {
    final t = ForgeTokens.of(context);
    switch (status) {
      case 'ready':
        return t.secondary;
      case 'processing':
      case 'uploading':
      case 'pending':
        return t.primary;
      case 'failed':
        return t.error;
      default:
        return t.onSurfaceVariant;
    }
  }
}
