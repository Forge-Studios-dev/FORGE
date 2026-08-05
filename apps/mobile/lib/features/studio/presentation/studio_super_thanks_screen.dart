import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

final superThanksReceivedProvider =
    FutureProvider.autoDispose<({List<Map<String, dynamic>> tips, Map<String, dynamic>? summary})>(
        (ref) async {
  final client = ref.read(apiClientProvider);
  final tipsRes = await client.dio.get('/billing/super-thanks/received', queryParameters: {'limit': 50});
  final tipsData = tipsRes.data['data'];
  final tips = <Map<String, dynamic>>[];
  Map<String, dynamic>? summary;
  if (tipsData is Map) {
    if (tipsData['data'] is List) {
      tips.addAll(
        (tipsData['data'] as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)),
      );
    }
    if (tipsData['summary'] is Map) {
      summary = Map<String, dynamic>.from(tipsData['summary'] as Map);
    }
  } else if (tipsData is List) {
    tips.addAll(tipsData.whereType<Map>().map((e) => Map<String, dynamic>.from(e)));
  }

  return (tips: tips, summary: summary);
});

class StudioSuperThanksScreen extends ConsumerWidget {
  const StudioSuperThanksScreen({super.key});

  String _money(num? cents) {
    final v = ((cents ?? 0) / 100);
    return '\$${v.toStringAsFixed(2)}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(superThanksReceivedProvider);
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Super Thanks'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Failed to load Super Thanks', style: TextStyle(color: t.onSurfaceVariant)),
              TextButton(
                onPressed: () => ref.invalidate(superThanksReceivedProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (data) {
          final summary = data.summary;
          final tips = data.tips;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              if (summary != null) ...[
                ForgeCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'All-time summary',
                        style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Gross ${_money(summary['totalAmountCents'] as num?)} · '
                        'Net ${_money(summary['totalCreatorNetCents'] as num?)} · '
                        '${summary['totalTips'] ?? 0} tips',
                        style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],
              Text(
                'Received',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: t.onSurface),
              ),
              const SizedBox(height: 12),
              if (tips.isEmpty)
                ForgeCard(
                  child: Text(
                    'No Super Thanks yet. Tips from viewers will show here.',
                    style: TextStyle(color: t.onSurfaceVariant),
                  ),
                )
              else
                ...tips.map((tip) {
                  final tipper = tip['tipper'] as Map<String, dynamic>?;
                  final amount = tip['amountCents'] as num? ?? 0;
                  final net = tip['creatorNetCents'] as num?;
                  final from = tipper?['displayName'] as String? ??
                      tipper?['username'] as String? ??
                      'Viewer';
                  final videoTitle = tip['videoTitle'] as String? ?? 'Video';
                  final body = tip['body'] as String?;
                  final created = tip['createdAt'] as String?;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: ForgeCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  from,
                                  style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                                ),
                              ),
                              Text(
                                _money(amount),
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: t.primary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            videoTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                          ),
                          if (net != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              'Net ${_money(net)}',
                              style: TextStyle(fontSize: 12, color: t.outline),
                            ),
                          ],
                          if (body != null && body.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(body, style: TextStyle(fontSize: 13, color: t.onSurface)),
                          ],
                          if (created != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              created,
                              style: TextStyle(fontSize: 11, color: t.outline),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
            ],
          );
        },
      ),
    );
  }
}
