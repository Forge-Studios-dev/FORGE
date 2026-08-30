import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../../core/widgets/forge_empty_state.dart';

typedef StudioAttention = ({
  Map<String, int> counts,
  List<Map<String, dynamic>> items,
});

final studioAttentionProvider = FutureProvider.autoDispose<StudioAttention>((ref) async {
  final res = await ref.read(apiClientProvider).dio.get('/creators/me/attention');
  final data = res.data['data'];
  if (data is! Map) {
    return (counts: <String, int>{}, items: <Map<String, dynamic>>[]);
  }
  final countsRaw = data['counts'];
  final counts = <String, int>{};
  if (countsRaw is Map) {
    for (final e in countsRaw.entries) {
      counts['${e.key}'] = (e.value as num?)?.toInt() ?? 0;
    }
  }
  final itemsRaw = data['items'];
  final items = itemsRaw is List
      ? itemsRaw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
      : <Map<String, dynamic>>[];
  return (counts: counts, items: items);
});

/// Studio Attention inbox — comments, moderation, billing, processing (web parity).
class StudioAttentionScreen extends ConsumerWidget {
  const StudioAttentionScreen({super.key});

  Color _toneColor(BuildContext context, String? tone) {
    final t = ForgeTokens.of(context);
    return switch (tone) {
      'critical' => t.error,
      'warning' => t.warning,
      _ => t.primary,
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studioAttentionProvider);
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attention'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(studioAttentionProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Could not load attention queue', style: TextStyle(color: t.error)),
                const SizedBox(height: 12),
                ForgeButton(
                  label: 'Retry',
                  onPressed: () => ref.invalidate(studioAttentionProvider),
                ),
              ],
            ),
          ),
        ),
        data: (attention) {
          final c = attention.counts;
          final comments = c['commentsNeedingReply'] ?? 0;
          final held = c['heldComments'] ?? 0;
          final moderation = c['pendingModeration'] ?? 0;
          final payments = c['failedPayments'] ?? 0;
          final processing = c['processingFailures'] ?? 0;
          final scheduled = c['scheduledUpcoming'] ?? 0;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(studioAttentionProvider),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Text(
                  'A single queue for replies, held comments, moderation, payments, processing, and upcoming publishes.',
                  style: TextStyle(color: t.onSurfaceVariant, height: 1.4),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _CountChip(
                      label: 'Comments',
                      value: comments,
                      onTap: () => context.push('/studio/comments'),
                    ),
                    _CountChip(
                      label: 'Held',
                      value: held,
                      onTap: () => context.push('/studio/comments?filter=held'),
                    ),
                    _CountChip(
                      label: 'Moderation',
                      value: moderation,
                      onTap: () => context.push('/studio/moderation'),
                    ),
                    _CountChip(
                      label: 'Payments',
                      value: payments,
                      onTap: () => context.push('/studio/earnings'),
                    ),
                    _CountChip(
                      label: 'Processing',
                      value: processing,
                      onTap: () => context.push('/studio/videos?status=failed'),
                    ),
                    _CountChip(
                      label: 'Scheduled',
                      value: scheduled,
                      onTap: () => context.push('/studio/videos?scheduled=1'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'What needs action',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/studio/comments'),
                      child: const Text('Comments'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (attention.items.isEmpty)
                  ForgeEmptyState(
                    icon: Icons.notifications_active_outlined,
                    title: 'Nothing urgent right now',
                    description:
                        'Your creator queue is clear. Publish, go live, or check analytics while things are quiet.',
                    actionLabel: 'Upload a video',
                    onAction: () => context.push('/upload'),
                  )
                else
                  ...attention.items.map((item) {
                    final href = item['href'] as String? ?? '/studio';
                    final tone = item['tone'] as String?;
                    final kind = (item['kind'] as String? ?? 'item').replaceAll('_', ' ');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: ForgeCard(
                        onTap: () => context.push(href),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: _toneColor(context, tone).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                kind,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: _toneColor(context, tone),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              item['label'] as String? ?? 'Item',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: t.onSurface,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item['detail'] as String? ?? '',
                              style: TextStyle(fontSize: 13, color: t.onSurfaceVariant, height: 1.35),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Review',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: t.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({
    required this.label,
    required this.value,
    this.onTap,
  });

  final String label;
  final int value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final child = Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: t.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: t.onSurfaceVariant)),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: t.onSurface,
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return child;
    return Semantics(
      button: true,
      label: '$label, $value',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: child,
      ),
    );
  }
}
