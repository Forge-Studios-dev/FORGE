import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/csv_export_util.dart';
import '../../../core/widgets/forge_card.dart';

final studioEarningsProvider =
    FutureProvider.autoDispose.family<Map<String, dynamic>, int>((ref, days) async {
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get(
    '/creators/me/earnings',
    queryParameters: {'days': days},
  );
  final data = res.data['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  return {};
});

final studioMonetizationEligibilityProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.read(apiClientProvider);
  final res = await client.dio.get('/creators/me/monetization/eligibility');
  final data = res.data['data'];
  if (data is Map) return Map<String, dynamic>.from(data);
  return {};
});

class StudioEarningsScreen extends ConsumerStatefulWidget {
  const StudioEarningsScreen({super.key});

  @override
  ConsumerState<StudioEarningsScreen> createState() => _StudioEarningsScreenState();
}

class _StudioEarningsScreenState extends ConsumerState<StudioEarningsScreen> {
  int _days = 30;
  bool _exporting = false;

  String _money(num? cents) => '\$${((cents ?? 0) / 100).toStringAsFixed(2)}';

  String _count(num? n) {
    final v = n ?? 0;
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(1)}K';
    return v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(1);
  }

  Future<void> _exportCsv() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      await CsvExportUtil.downloadAndShare(
        dio: ref.read(apiClientProvider).dio,
        apiPath: '/creators/me/earnings/export?days=$_days',
        filename: 'forge-earnings-${_days}d.csv',
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not export CSV')),
      );
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Widget _eligibilityCard(Map<String, dynamic> e, ForgeTokens t) {
    final eligible = e['eligible'] == true;
    return ForgeCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Monetization eligibility',
                  style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                ),
              ),
              Text(
                eligible ? 'Eligible' : 'Not yet',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: eligible ? Colors.green.shade700 : t.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'YPP-style: 1,000 subs + 4,000 watch hours (12 mo) or 10M Shorts views (90d). '
            'Read-only until ad revenue ships.',
            style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
          ),
          const SizedBox(height: 12),
          Text(
            'Subscribers ${_count(e['subscriberCount'] as num?)} / ${_count(e['subscriberThreshold'] as num?)}',
            style: TextStyle(fontSize: 13, color: t.onSurface),
          ),
          Text(
            'Watch hours ${_count(e['watchHours365d'] as num?)} / ${_count(e['watchHoursThreshold'] as num?)}',
            style: TextStyle(fontSize: 13, color: t.onSurface),
          ),
          Text(
            'Shorts views ${_count(e['shortsViews90d'] as num?)} / ${_count(e['shortsViewsThreshold'] as num?)}',
            style: TextStyle(fontSize: 13, color: t.onSurface),
          ),
          if (e['hasActiveUploadRestriction'] == true)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Upload restriction active',
                style: TextStyle(fontSize: 13, color: Colors.orange.shade800),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(studioEarningsProvider(_days));
    final eligibilityAsync = ref.watch(studioMonetizationEligibilityProvider);
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Earnings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
        actions: [
          TextButton(
            onPressed: _exporting ? null : _exportCsv,
            child: Text(_exporting ? 'Exporting…' : 'Export CSV'),
          ),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(
              children: [7, 30, 90, 365].map((d) {
                final selected = _days == d;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text('${d}d'),
                    selected: selected,
                    onSelected: (_) => setState(() => _days = d),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Couldn’t load earnings', style: TextStyle(color: t.onSurfaceVariant)),
                    TextButton(
                      onPressed: () => ref.invalidate(studioEarningsProvider(_days)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (data) {
                final subs = data['subscriptions'] is Map
                    ? Map<String, dynamic>.from(data['subscriptions'] as Map)
                    : <String, dynamic>{};
                final thanks = data['superThanks'] is Map
                    ? Map<String, dynamic>.from(data['superThanks'] as Map)
                    : <String, dynamic>{};
                final chat = data['superChat'] is Map
                    ? Map<String, dynamic>.from(data['superChat'] as Map)
                    : <String, dynamic>{};

                return ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    eligibilityAsync.when(
                      loading: () => ForgeCard(
                        child: Text(
                          'Checking monetization eligibility…',
                          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                        ),
                      ),
                      error: (_, __) => ForgeCard(
                        child: Text(
                          'Couldn’t load monetization eligibility',
                          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                        ),
                      ),
                      data: (e) => e.isEmpty
                          ? const SizedBox.shrink()
                          : _eligibilityCard(e, t),
                    ),
                    const SizedBox(height: 12),
                    ForgeCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Tips net (${data['periodDays'] ?? _days}d)',
                            style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _money(data['totalCreatorNetCents'] as num?),
                            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: t.onSurface),
                          ),
                          Text(
                            'Super Thanks + Super Chat',
                            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ForgeCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Membership MRR', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
                          const SizedBox(height: 8),
                          Text(_money(subs['mrrCents'] as num?), style: TextStyle(fontSize: 22, color: t.onSurface)),
                          Text(
                            '${subs['activeSubscribers'] ?? 0} active members',
                            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ForgeCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Super Thanks', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
                          const SizedBox(height: 8),
                          Text(_money(thanks['creatorNetCents'] as num?), style: TextStyle(fontSize: 22, color: t.onSurface)),
                          Text(
                            '${thanks['tipCount'] ?? 0} tips · gross ${_money(thanks['totalAmountCents'] as num?)}',
                            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                          ),
                          TextButton(
                            onPressed: () => context.push('/studio/super-thanks'),
                            child: const Text('Open Super Thanks ledger'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ForgeCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Super Chat', style: TextStyle(fontWeight: FontWeight.w600, color: t.onSurface)),
                          const SizedBox(height: 8),
                          Text(_money(chat['creatorNetCents'] as num?), style: TextStyle(fontSize: 22, color: t.onSurface)),
                          Text(
                            '${chat['tipCount'] ?? 0} tips · gross ${_money(chat['totalAmountCents'] as num?)}',
                            style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    ForgeCard(
                      child: Text(
                        'Ad revenue ${_money(data['adRevenueCents'] as num?)} — not integrated yet. '
                        'Payouts settle through Stripe Connect.',
                        style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
