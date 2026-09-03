import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/csv_export_util.dart';
import '../../../core/widgets/forge_card.dart';
import 'studio_analytics_screen.dart';

/// Focused video-performance table (parity with web `/studio/analytics/details`).
class StudioAnalyticsDetailsScreen extends ConsumerStatefulWidget {
  const StudioAnalyticsDetailsScreen({super.key});

  @override
  ConsumerState<StudioAnalyticsDetailsScreen> createState() =>
      _StudioAnalyticsDetailsScreenState();
}

class _StudioAnalyticsDetailsScreenState
    extends ConsumerState<StudioAnalyticsDetailsScreen> {
  int _periodDays = 28;
  bool _exporting = false;

  Future<void> _export(List<Map<String, dynamic>> topVideos) async {
    setState(() => _exporting = true);
    try {
      String esc(Object? v) {
        final s = '${v ?? ''}';
        if (s.contains(',') || s.contains('"') || s.contains('\n')) {
          return '"${s.replaceAll('"', '""')}"';
        }
        return s;
      }

      final buf = StringBuffer('title,videoId,views,impressions,ctr_percent,avg_watch_percent\n');
      for (final row in topVideos) {
        final ctr = row['ctr'];
        final ctrPct = ctr is num ? (ctr * 1000).round() / 10 : '';
        buf.writeln([
          esc(row['title']),
          esc(row['videoId']),
          esc(row['views'] ?? 0),
          esc(row['impressions'] ?? 0),
          esc(ctrPct),
          esc(row['avgWatchPercent'] ?? ''),
        ].join(','));
      }
      await CsvExportUtil.shareCsvText(
        csv: buf.toString(),
        filename: 'video-performance-${_periodDays}d.csv',
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not export video performance')),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final performanceAsync = ref.watch(videoPerformanceProvider(_periodDays));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Video performance'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio/analytics'),
        ),
        actions: [
          PopupMenuButton<int>(
            tooltip: 'Performance window',
            initialValue: _periodDays,
            onSelected: (d) => setState(() => _periodDays = d),
            itemBuilder: (_) => const [
              PopupMenuItem(value: 7, child: Text('Last 7 days')),
              PopupMenuItem(value: 28, child: Text('Last 28 days')),
              PopupMenuItem(value: 90, child: Text('Last 90 days')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${_periodDays}d', style: const TextStyle(fontSize: 13)),
                  const Icon(Icons.arrow_drop_down),
                ],
              ),
            ),
          ),
        ],
      ),
      body: performanceAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text('Failed to load performance', style: TextStyle(color: t.onSurfaceVariant)),
        ),
        data: (perf) {
          final topVideos =
              (perf?['topVideos'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
          final periodDays = (perf?['periodDays'] as num?)?.toInt() ?? _periodDays;
          if (topVideos.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ForgeCard(
                child: Text(
                  'No video performance yet for the last $periodDays days.',
                  style: TextStyle(color: t.onSurfaceVariant),
                ),
              ),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Top videos by views · last $periodDays days',
                style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _exporting ? null : () => _export(topVideos),
                  child: Text(_exporting ? 'Exporting…' : 'Export CSV'),
                ),
              ),
              const SizedBox(height: 8),
              ...topVideos.map(
                (row) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: ForgeCard(
                    onTap: () {
                      final id = row['videoId'] as String?;
                      if (id != null) context.push('/studio/videos/$id');
                    },
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row['title'] as String? ?? 'Video',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${row['views'] ?? 0} views · ${row['impressions'] ?? 0} impr. · '
                          '${row['ctr'] != null ? '${(((row['ctr'] as num) * 1000).round() / 10)}% CTR' : '—'} · '
                          '${row['avgWatchPercent'] != null ? '${(row['avgWatchPercent'] as num).round()}% watch' : '—'}',
                          style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
