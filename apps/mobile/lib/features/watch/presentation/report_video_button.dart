import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/report_reasons.dart';
import '../data/watch_repository.dart';

class ReportVideoButton extends ConsumerStatefulWidget {
  final String videoId;
  const ReportVideoButton({required this.videoId});

  @override
  ConsumerState<ReportVideoButton> createState() => _ReportVideoButtonState();
}

class _ReportVideoButtonState extends ConsumerState<ReportVideoButton> {
  Future<void> _openSheet() async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text('Report video', style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            ...kVideoReportReasons.map(
              (r) => ListTile(
                title: Text(r),
                onTap: () => Navigator.pop(ctx, r),
              ),
            ),
          ],
        ),
      ),
    );
    if (reason == null || !mounted) return;
    if (await handleCopyrightReportIfNeeded(
      context: context,
      videoId: widget.videoId,
      reason: reason,
    )) {
      return;
    }
    try {
      await ref.read(watchRepositoryProvider).reportVideo(
            videoId: widget.videoId,
            reason: reason,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report submitted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to report content')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: _openSheet,
        icon: Icon(Icons.flag_outlined, size: 18),
        label: const Text('Report'),
        style: TextButton.styleFrom(foregroundColor: ForgeTokens.of(context).outline),
      ),
    );
  }
}
