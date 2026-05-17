import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../data/upload_repository.dart';

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key});

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _skillCtrl = TextEditingController();
  PlatformFile? _file;
  bool _uploading = false;
  int _progress = 0;
  String? _error;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _skillCtrl.dispose();
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
    if (_titleCtrl.text.trim().isEmpty) {
      setState(() => _error = 'Title is required.');
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
            skillTagName: _skillCtrl.text,
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
            const SizedBox(height: 12),
            TextField(
              controller: _skillCtrl,
              decoration: const InputDecoration(labelText: 'Skill tag (optional)'),
            ),
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
}
