import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/csv_export_util.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../shared/models/video.dart';
import '../data/studio_repository.dart';

final businessAnalyticsProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  try {
    final client = ref.read(apiClientProvider);
    final res = await client.dio.get('/creators/me/business-analytics');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

final videoPerformanceProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>?, int>((ref, days) async {
  try {
    final client = ref.read(apiClientProvider);
    final res = await client.dio.get(
      '/analytics/studio/video-performance',
      queryParameters: {'days': days},
    );
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

final studioRealtimeProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  try {
    final client = ref.read(apiClientProvider);
    final res = await client.dio.get('/analytics/studio/realtime');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

final studioAnalyticsProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) async {
  final page = await ref.read(studioRepositoryProvider).getMyVideos(limit: 50);
  return page.items;
});

class StudioAnalyticsScreen extends ConsumerStatefulWidget {
  const StudioAnalyticsScreen({super.key});

  @override
  ConsumerState<StudioAnalyticsScreen> createState() => _StudioAnalyticsScreenState();
}

class _StudioAnalyticsScreenState extends ConsumerState<StudioAnalyticsScreen> {
  bool _exporting = false;
  int _periodDays = 28;

  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    try {
      final client = ref.read(apiClientProvider);
      await CsvExportUtil.downloadAndShare(
        dio: client.dio,
        apiPath: '/creators/me/business-analytics/export',
        filename: 'business-analytics.csv',
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not export analytics')),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _exportVideoPerformanceCsv(List<Map<String, dynamic>> topVideos) async {
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
    final videosAsync = ref.watch(studioAnalyticsProvider);
    final businessAsync = ref.watch(businessAnalyticsProvider);
    final performanceAsync = ref.watch(videoPerformanceProvider(_periodDays));
    final realtimeAsync = ref.watch(studioRealtimeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
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
          TextButton.icon(
            onPressed: _exporting ? null : _exportCsv,
            icon: _exporting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download_outlined, size: 18),
            label: const Text('Business'),
          ),
        ],
      ),
      body: videosAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load analytics')),
        data: (videos) {
          if (videos.isEmpty) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  ForgeCard(
                    child: Text(
                      'Upload videos to track views and engagement.',
                      style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload video', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }

          final totalViews = videos.fold<int>(0, (s, v) => s + v.viewCount);
          final totalLikes = videos.fold<int>(0, (s, v) => s + v.likeCount);
          final ready = videos.where((v) => v.status == 'ready').length;
          final perf = performanceAsync.value;
          final realtime = realtimeAsync.value;
          final impressions = (perf?['impressions'] as num?)?.toInt();
          final ctr = (perf?['ctr'] as num?)?.toDouble();
          final avgWatch = (perf?['avgWatchPercent'] as num?)?.toDouble();
          final periodDays = (perf?['periodDays'] as num?)?.toInt() ?? 28;
          final topVideos = (perf?['topVideos'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          final realtimeViews = (realtime?['views'] as num?)?.toInt();
          final realtimeImpressions = (realtime?['impressions'] as num?)?.toInt();
          final realtimeWindow = (realtime?['windowMinutes'] as num?)?.toInt() ?? 60;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (realtimeViews != null || realtimeImpressions != null) ...[
                Text(
                  'Last $realtimeWindow minutes',
                  style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: _stat('Realtime views', '${realtimeViews ?? 0}')),
                    const SizedBox(width: 12),
                    Expanded(child: _stat('Realtime impressions', '${realtimeImpressions ?? 0}')),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              if (impressions != null || ctr != null || avgWatch != null) ...[
                Text(
                  'Last $periodDays days',
                  style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(child: _stat('Impressions', '${impressions ?? 0}')),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _stat(
                        'CTR',
                        ctr != null ? '${(ctr * 1000).round() / 10}%' : '—',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _stat(
                        'Avg watch',
                        avgWatch != null ? '${avgWatch.round()}%' : '—',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              businessAsync.when(
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
                data: (biz) {
                  if (biz == null) return const SizedBox.shrink();
                  final membership = biz['membership'] as Map<String, dynamic>?;
                  final funnel = (biz['funnel'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                  final cohortRetention = biz['cohortRetention'] as Map<String, dynamic>?;
                  final weekly =
                      (cohortRetention?['weekly'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                  final monthly =
                      (cohortRetention?['monthly'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ForgeCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Membership', style: TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 8),
                              Text(
                                'Active: ${membership?['active'] ?? 0} · MRR \$${((membership?['mrrCents'] as num? ?? 0) / 100).round()}',
                                style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
                              ),
                            ],
                          ),
                        ),
                        if (funnel.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          ForgeCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Engagement funnel', style: TextStyle(fontWeight: FontWeight.w600)),
                                const SizedBox(height: 8),
                                ...funnel.take(5).map(
                                      (step) => Padding(
                                        padding: const EdgeInsets.only(bottom: 6),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Text(
                                              step['label'] as String? ?? '',
                                              style: const TextStyle(fontSize: 12),
                                            ),
                                            Text(
                                              '${step['count']}',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: ForgeTokens.of(context).primary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                              ],
                            ),
                          ),
                        ],
                        if (weekly.isNotEmpty)
                          _cohortCard('Weekly cohort retention', weekly.take(4).toList()),
                        if (monthly.isNotEmpty)
                          _cohortCard('Monthly cohort retention', monthly.take(4).toList()),
                      ],
                    ),
                  );
                },
              ),
              Row(
                children: [
                  Expanded(child: _stat('Views', '$totalViews')),
                  const SizedBox(width: 12),
                  Expanded(child: _stat('Likes', '$totalLikes')),
                  const SizedBox(width: 12),
                  Expanded(child: _stat('Published', '$ready')),
                ],
              ),
              const SizedBox(height: 24),
              const Text('Top videos', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              if (topVideos.isNotEmpty)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _exporting ? null : () => _exportVideoPerformanceCsv(topVideos),
                    child: const Text('Export videos CSV'),
                  ),
                ),
              const SizedBox(height: 12),
              if (topVideos.isNotEmpty)
                ...topVideos.take(8).map(
                      (row) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
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
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: ForgeTokens.of(context).onSurface),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${row['views'] ?? 0} views · ${row['impressions'] ?? 0} impr. · '
                                '${row['ctr'] != null ? '${(((row['ctr'] as num) * 1000).round() / 10)}% CTR' : '—'} · '
                                '${row['avgWatchPercent'] != null ? '${(row['avgWatchPercent'] as num).round()}% watch' : '—'}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: ForgeTokens.of(context).onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
              else
                ...videos.take(8).map(
                      (v) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          onTap: () => context.push('/studio/videos/${v.id}'),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  v.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: ForgeTokens.of(context).onSurface),
                                ),
                              ),
                              Text(
                                '${v.viewCount} views',
                                style: TextStyle(color: ForgeTokens.of(context).primary, fontSize: 13),
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

  Widget _stat(String label, String value) {
    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: ForgeTokens.of(context).primary)),
        ],
      ),
    );
  }

  Widget _cohortCard(String title, List<Map<String, dynamic>> rows) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ForgeCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            ...rows.map((row) {
              final rate = (row['retentionRate'] as num?)?.toDouble() ?? 0;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(row['period'] as String? ?? '', style: const TextStyle(fontSize: 12)),
                        Text(
                          '${row['retained']}/${row['cohortSize']} · ${rate.round()}%',
                          style: TextStyle(fontSize: 11, color: ForgeTokens.of(context).onSurfaceVariant),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: rate / 100,
                        minHeight: 6,
                        backgroundColor: ForgeTokens.of(context).surfaceContainerHigh,
                        color: ForgeTokens.of(context).primary,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}
