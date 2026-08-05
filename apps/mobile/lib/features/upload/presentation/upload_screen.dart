import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/upload_repository.dart';

/// Categories with their selectable skill tags, used to satisfy the required
/// categoryId + skillTagIds fields on the complete-upload contract.
final uploadOptionsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/categories/upload-options');
  final list = response.data['data'] as List? ?? [];
  return list.cast<Map<String, dynamic>>();
});

const _visibilityOptions = <({String value, String label})>[
  (value: 'public', label: 'Public — anyone can discover'),
  (value: 'unlisted', label: 'Unlisted — only with the link'),
  (value: 'private', label: 'Private — only you'),
  (value: 'followers', label: 'Subscribers only'),
  (value: 'subscribers', label: 'Members only'),
];

const _shortMaxSeconds = 60;
const _shortTooLongMessage =
    'Shorts must be 60 seconds or shorter. Upload as a regular video instead.';

Future<Duration?> _probeVideoDuration(String path) async {
  final controller = VideoPlayerController.file(File(path));
  try {
    await controller.initialize();
    return controller.value.duration;
  } catch (_) {
    return null;
  } finally {
    await controller.dispose();
  }
}

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> with WidgetsBindingObserver {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  PlatformFile? _file;
  PlatformFile? _thumbnail;
  String? _categoryId;
  final Set<String> _skillTagIds = {};
  String _visibility = 'public';
  String _videoType = 'video';
  bool _scheduleEnabled = false;
  DateTime? _scheduledAt;
  bool _uploading = false;
  int _progress = 0;
  String? _error;
  PendingUpload? _pendingResume;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _checkForResumableUpload();
  }

  Future<void> _checkForResumableUpload() async {
    final pending = await ref.read(uploadRepositoryProvider).getPendingUpload();
    if (mounted) setState(() => _pendingResume = pending);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Best-effort only: this does not keep the transfer running while
    // backgrounded — it just records that it was interrupted so the UI can
    // surface a clear "paused" state (and a resume path) instead of the
    // upload silently failing. See UploadRepository.markBackgrounded.
    if (state == AppLifecycleState.paused && _uploading) {
      ref.read(uploadRepositoryProvider).markBackgrounded();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.pickFiles(
      type: FileType.video,
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    final path = file.path;
    if (path == null) {
      setState(() => _error = 'Could not read selected file.');
      return;
    }
    final size = file.size;
    final type = file.extension == 'mov' ? 'video/quicktime' : 'video/mp4';
    if (!UploadRepository.allowedTypes.contains(type)) {
      setState(() => _error = 'File must be MP4 or MOV.');
      return;
    }
    if (size > UploadRepository.maxBytes) {
      setState(() => _error = 'File must be 500MB or smaller.');
      return;
    }
    if (_videoType == 'short') {
      final duration = await _probeVideoDuration(path);
      if (duration != null && duration.inSeconds > _shortMaxSeconds) {
        setState(() => _error = _shortTooLongMessage);
        return;
      }
    }
    setState(() {
      _file = file;
      _error = null;
    });
  }

  Future<void> _pickThumbnail() async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.single;
    if (file.path == null) {
      setState(() => _error = 'Could not read thumbnail file.');
      return;
    }
    setState(() {
      _thumbnail = file;
      _error = null;
    });
  }

  String? _thumbnailContentType(PlatformFile file) {
    final ext = (file.extension ?? '').toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return null;
    }
  }

  Future<void> _upload() async {
    if (_file?.path == null) {
      setState(() => _error = 'Select a video file first.');
      return;
    }
    if (_titleCtrl.text.trim().length < 3) {
      setState(() => _error = 'Title must be at least 3 characters.');
      return;
    }
    if (_categoryId == null) {
      setState(() => _error = 'Choose a category.');
      return;
    }
    if (_videoType == 'short' && _file!.path != null) {
      final duration = await _probeVideoDuration(_file!.path!);
      if (duration != null && duration.inSeconds > _shortMaxSeconds) {
        setState(() => _error = _shortTooLongMessage);
        return;
      }
    }
    if (_scheduleEnabled) {
      final at = _scheduledAt;
      if (at == null || at.isBefore(DateTime.now().add(const Duration(minutes: 15)))) {
        setState(() => _error = 'Pick a publish time at least 15 minutes from now.');
        return;
      }
    }
    setState(() {
      _uploading = true;
      _error = null;
      _progress = 0;
    });
    try {
      final type = _file!.extension == 'mov' ? 'video/quicktime' : 'video/mp4';
      final thumbType = _thumbnail != null ? _thumbnailContentType(_thumbnail!) : null;
      if (_thumbnail != null && thumbType == null) {
        setState(() {
          _uploading = false;
          _error = 'Thumbnail must be JPEG, PNG, or WebP.';
        });
        return;
      }
      final videoId = await ref.read(uploadRepositoryProvider).uploadVideo(
            filePath: _file!.path!,
            contentType: type,
            fileSizeBytes: _file!.size,
            title: _titleCtrl.text,
            description: _descCtrl.text,
            categoryId: _categoryId!,
            skillTagIds: _skillTagIds.toList(),
            visibility: _visibility,
            videoType: _videoType,
            scheduledPublishAt:
                _scheduleEnabled && _scheduledAt != null ? _scheduledAt!.toUtc().toIso8601String() : null,
            thumbnailPath: _thumbnail?.path,
            thumbnailContentType: thumbType,
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      if (!mounted) return;
      setState(() => _pendingResume = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _scheduleEnabled
                ? 'Upload complete — will publish at ${_scheduledAt!.toLocal()}.'
                : 'Upload complete — processing started.',
          ),
        ),
      );
      context.go('/studio/videos/$videoId');
    } catch (e) {
      if (mounted) setState(() => _error = 'Upload failed. Check connection and try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _resumeUpload() async {
    setState(() {
      _uploading = true;
      _error = null;
      _progress = 0;
    });
    try {
      final videoId = await ref.read(uploadRepositoryProvider).resumePendingUpload(
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      if (!mounted) return;
      setState(() => _pendingResume = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload complete — processing started.')),
      );
      context.go('/watch/$videoId');
    } catch (e) {
      if (mounted) setState(() => _error = 'Resume failed. Check connection and try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _discardResumableUpload() async {
    await ref.read(uploadRepositoryProvider).clearResumableUpload();
    if (mounted) setState(() => _pendingResume = null);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_videoType == 'short' ? 'Create a Short' : 'Upload video')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: TextStyle(color: ForgeTokens.of(context).error)),
              ),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'video', label: Text('Video'), icon: Icon(Icons.videocam_outlined)),
                ButtonSegment(value: 'short', label: Text('Short'), icon: Icon(Icons.smart_display_outlined)),
              ],
              selected: {_videoType},
              onSelectionChanged: _uploading
                  ? null
                  : (s) => setState(() => _videoType = s.first),
            ),
            if (_videoType == 'short')
              Padding(
                padding: EdgeInsets.only(top: 8, bottom: 4),
                child: Text(
                  'Shorts must be 60 seconds or shorter.',
                  style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13),
                ),
              ),
            const SizedBox(height: 16),
            if (_pendingResume != null && !_uploading)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: ForgeCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _pendingResume!.backgrounded
                            ? 'Upload paused — reopen the app to continue.'
                            : 'You have an unfinished upload.',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: ForgeTokens.of(context).onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _pendingResume!.title,
                        style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ForgeButton(
                              label: 'Resume upload',
                              onPressed: _resumeUpload,
                            ),
                          ),
                          const SizedBox(width: 8),
                          TextButton(
                            onPressed: _discardResumableUpload,
                            child: const Text('Discard'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickFile,
              icon: const Icon(Icons.video_file_outlined),
              label: Text(_file == null ? 'Choose video (MP4/MOV)' : _file!.name),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickThumbnail,
              icon: const Icon(Icons.image_outlined),
              label: Text(
                _thumbnail == null
                    ? 'Custom thumbnail (optional)'
                    : _thumbnail!.name,
              ),
            ),
            if (_thumbnail != null && !_uploading)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _thumbnail = null),
                  child: const Text('Remove thumbnail'),
                ),
              ),
            const SizedBox(height: 20),
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Description (optional)',
                helperText: 'Chapters: lines like 0:00 Intro (need ≥3, start at 0:00)',
              ),
            ),
            const SizedBox(height: 16),
            _buildCategoryAndSkills(),
            const SizedBox(height: 16),
            _buildVisibilitySelector(),
            const SizedBox(height: 8),
            _buildScheduleSelector(),
            if (_uploading) ...[
              const SizedBox(height: 24),
              LinearProgressIndicator(value: _progress / 100),
              const SizedBox(height: 8),
              Text('Uploading… $_progress%', textAlign: TextAlign.center),
            ],
            const SizedBox(height: 24),
            ForgeButton(
              label: _uploading ? 'Uploading…' : 'Upload',
              onPressed: _uploading ? null : _upload,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryAndSkills() {
    final optionsAsync = ref.watch(uploadOptionsProvider);
    return optionsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: LinearProgressIndicator(),
      ),
      error: (_, __) => Text(
        'Could not load categories. Pull to retry.',
        style: TextStyle(color: ForgeTokens.of(context).error),
      ),
      data: (categories) {
        if (categories.isEmpty) {
          return const Text('No categories available yet.');
        }
        final selected = categories.firstWhere(
          (c) => c['id'] == _categoryId,
          orElse: () => const <String, dynamic>{},
        );
        final skillTags =
            (selected['skillTags'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              value: _categoryId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Category'),
              items: categories
                  .map((c) => DropdownMenuItem<String>(
                        value: c['id'] as String,
                        child: Text(c['name'] as String? ?? 'Category'),
                      ))
                  .toList(),
              onChanged: _uploading
                  ? null
                  : (value) => setState(() {
                        _categoryId = value;
                        _skillTagIds.clear();
                      }),
            ),
            if (_categoryId != null) ...[
              const SizedBox(height: 12),
              Text(
                'Topic tags (optional)',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 6),
              if (skillTags.isEmpty)
                const Text('No tags for this category.')
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: skillTags.map((tag) {
                    final id = tag['id'] as String;
                    final selectedTag = _skillTagIds.contains(id);
                    return FilterChip(
                      label: Text(tag['name'] as String? ?? ''),
                      selected: selectedTag,
                      onSelected: _uploading
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
          ],
        );
      },
    );
  }

  Widget _buildVisibilitySelector() {
    return DropdownButtonFormField<String>(
      value: _visibility,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Visibility'),
      items: _visibilityOptions
          .map((o) => DropdownMenuItem<String>(
                value: o.value,
                child: Text(o.label, overflow: TextOverflow.ellipsis),
              ))
          .toList(),
      onChanged: _uploading
          ? null
          : (value) => setState(() => _visibility = value ?? 'public'),
    );
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

  Widget _buildScheduleSelector() {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Schedule publish'),
          subtitle: Text(
            _scheduleEnabled && _scheduledAt != null
                ? _scheduledAt!.toLocal().toString()
                : 'Publish when processing finishes',
            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
          ),
          value: _scheduleEnabled,
          onChanged: _uploading
              ? null
              : (on) {
                  setState(() {
                    _scheduleEnabled = on;
                    if (on && _scheduledAt == null) {
                      _scheduledAt = DateTime.now().add(const Duration(hours: 1));
                    }
                  });
                  if (on) _pickSchedule();
                },
        ),
        if (_scheduleEnabled && !_uploading)
          TextButton.icon(
            onPressed: _pickSchedule,
            icon: const Icon(Icons.event, size: 18),
            label: const Text('Pick date & time'),
          ),
      ],
    );
  }
}
