import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../data/studio_repository.dart';

/// Explains resumable multipart upload + recovery actions (parity with web
/// `/studio/upload-reliability`).
class StudioUploadReliabilityScreen extends ConsumerStatefulWidget {
  const StudioUploadReliabilityScreen({super.key});

  @override
  ConsumerState<StudioUploadReliabilityScreen> createState() =>
      _StudioUploadReliabilityScreenState();
}

class _StudioUploadReliabilityScreenState
    extends ConsumerState<StudioUploadReliabilityScreen> {
  bool _clearing = false;

  static const _phases = <({String title, String detail})>[
    (title: 'Checksum / prepare', detail: 'File validated and upload slot reserved.'),
    (title: 'Chunked transfer', detail: 'Parts upload concurrently with checkpointing.'),
    (title: 'Upload verification', detail: 'Completed parts reconciled against server progress.'),
    (title: 'Server assemble', detail: 'Multipart complete assembles the object for processing.'),
    (title: 'Transcoding queue', detail: 'Mux/VOD pipeline starts after finalize.'),
  ];

  Future<void> _clearStuck() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear stuck uploads?'),
        content: const Text(
          'Releases incomplete uploads that appear stuck so you can start fresh.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Clear')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _clearing = true);
    try {
      await ref.read(studioRepositoryProvider).releaseStuckUploads();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Stuck uploads cleared')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not clear stuck uploads')),
      );
    } finally {
      if (mounted) setState(() => _clearing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Upload reliability'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          ForgeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'How large uploads stay recoverable',
                  style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                ),
                const SizedBox(height: 8),
                Text(
                  'Files above the multipart threshold use resumable chunked upload with '
                  'server checkpoints so unstable networks can recover safely.',
                  style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          for (var i = 0; i < _phases.length; i++) ...[
            ForgeCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: t.primary.withValues(alpha: 0.15),
                    child: Text(
                      '${i + 1}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: t.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _phases[i].title,
                          style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _phases[i].detail,
                          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],
          ForgeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recovery tips', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
                const SizedBox(height: 8),
                Text(
                  '• Leave Studio open or return later — multipart progress is checkpointed.\n'
                  '• Use Clear stuck uploads if a transfer is abandoned.\n'
                  '• Cancel a single incomplete upload from Videos → menu.',
                  style: TextStyle(fontSize: 13, height: 1.4, color: t.onSurfaceVariant),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ForgeButton(
            label: _clearing ? 'Clearing…' : 'Clear stuck uploads',
            onPressed: _clearing ? null : _clearStuck,
          ),
          const SizedBox(height: 12),
          ForgeButton(
            label: 'Open Videos',
            onPressed: () => context.push('/studio/videos'),
          ),
          const SizedBox(height: 12),
          ForgeButton(
            label: 'Start an upload',
            onPressed: () => context.push('/upload'),
          ),
        ],
      ),
    );
  }
}
