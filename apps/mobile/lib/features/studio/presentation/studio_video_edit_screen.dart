import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/studio_repository.dart';

const _visibilityOptions = <({String value, String label})>[
  (value: 'public', label: 'Public'),
  (value: 'unlisted', label: 'Unlisted'),
  (value: 'private', label: 'Private'),
  (value: 'followers', label: 'Subscribers only'),
  (value: 'subscribers', label: 'Members only'),
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
  bool _scheduleEnabled = false;
  DateTime? _scheduledAt;
  bool _hydrated = false;
  bool _saving = false;
  bool _busy = false;
  String? _error;
  String? _savedMsg;

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
    final scheduled = video.scheduledPublishAt;
    if (scheduled != null && scheduled.isAfter(DateTime.now())) {
      _scheduleEnabled = true;
      _scheduledAt = scheduled.toLocal();
    }
    _hydrated = true;
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
            scheduledPublishAt:
                _scheduleEnabled && _scheduledAt != null ? _scheduledAt!.toUtc().toIso8601String() : null,
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
                      onPressed: () => context.push('/watch/${widget.videoId}'),
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
              ),
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
                const SizedBox(height: 12),
                ForgeButton(
                  label: 'Delete video',
                  onPressed: _busy || _saving ? null : _delete,
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
