import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
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

final studioAnalyticsProvider = FutureProvider.autoDispose<List<VideoModel>>((ref) {
  return ref.read(studioRepositoryProvider).getMyVideos();
});

class StudioAnalyticsScreen extends ConsumerWidget {
  const StudioAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videosAsync = ref.watch(studioAnalyticsProvider);
    final businessAsync = ref.watch(businessAnalyticsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
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
                  const ForgeCard(
                    child: Text(
                      'Upload lessons to track views and engagement.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ForgeButton(label: 'Upload lesson', onPressed: () => context.push('/upload')),
                ],
              ),
            );
          }

          final totalViews = videos.fold<int>(0, (s, v) => s + v.viewCount);
          final totalLikes = videos.fold<int>(0, (s, v) => s + v.likeCount);
          final ready = videos.where((v) => v.status == 'ready').length;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
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
                                'Active: ${membership?['active'] ?? 0} · MRR ₹${((membership?['mrrCents'] as num? ?? 0) / 100).round()}',
                                style: const TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
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
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: ForgeTokens.primary,
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
              const Text('Top lessons', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 12),
              ...videos.take(8).map(
                (v) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ForgeCard(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            v.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: ForgeTokens.onSurface),
                          ),
                        ),
                        Text('${v.viewCount} views', style: const TextStyle(color: ForgeTokens.primary, fontSize: 13)),
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
          Text(label, style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: ForgeTokens.primary)),
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
                          style: const TextStyle(fontSize: 11, color: ForgeTokens.onSurfaceVariant),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: rate / 100,
                        minHeight: 6,
                        backgroundColor: ForgeTokens.surfaceContainerHigh,
                        color: ForgeTokens.primary,
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
