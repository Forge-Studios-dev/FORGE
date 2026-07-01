import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
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
  (value: 'subscribers', label: 'Subscribers only'),
];

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  PlatformFile? _file;
  String? _categoryId;
  final Set<String> _skillTagIds = {};
  String _visibility = 'public';
  bool _uploading = false;
  int _progress = 0;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
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
    setState(() {
      _file = file;
      _error = null;
    });
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
    if (_skillTagIds.isEmpty) {
      setState(() => _error = 'Select at least one skill tag.');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
      _progress = 0;
    });
    try {
      final type = _file!.extension == 'mov' ? 'video/quicktime' : 'video/mp4';
      final videoId = await ref.read(uploadRepositoryProvider).uploadLesson(
            filePath: _file!.path!,
            contentType: type,
            fileSizeBytes: _file!.size,
            title: _titleCtrl.text,
            description: _descCtrl.text,
            categoryId: _categoryId!,
            skillTagIds: _skillTagIds.toList(),
            visibility: _visibility,
            onProgress: (p) {
              if (mounted) setState(() => _progress = p);
            },
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload complete — processing started.')),
      );
      context.go('/watch/$videoId');
    } catch (e) {
      setState(() => _error = 'Upload failed. Check connection and try again.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Upload lesson')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(_error!, style: const TextStyle(color: ForgeTokens.error)),
              ),
            OutlinedButton.icon(
              onPressed: _uploading ? null : _pickFile,
              icon: const Icon(Icons.video_file_outlined),
              label: Text(_file == null ? 'Choose video (MP4/MOV)' : _file!.name),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
            ),
            const SizedBox(height: 16),
            _buildCategoryAndSkills(),
            const SizedBox(height: 16),
            _buildVisibilitySelector(),
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
      error: (_, __) => const Text(
        'Could not load categories. Pull to retry.',
        style: TextStyle(color: ForgeTokens.error),
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
                'Skill tags',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 6),
              if (skillTags.isEmpty)
                const Text('No skill tags for this category.')
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
}
