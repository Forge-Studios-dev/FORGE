import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';

class MyMembershipsScreen extends ConsumerStatefulWidget {
  const MyMembershipsScreen({super.key});

  @override
  ConsumerState<MyMembershipsScreen> createState() => _MyMembershipsScreenState();
}

class _MyMembershipsScreenState extends ConsumerState<MyMembershipsScreen> {
  List<Map<String, dynamic>> _subscriptions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/subscriptions/me');
      setState(() {
        _subscriptions = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _openBillingPortal() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post('/billing/portal', data: {
        'returnUrl': 'forge://memberships',
      });
      final url = response.data['data']?['url'] as String?;
      if (url != null) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open billing portal')),
        );
      }
    }
  }

  Future<void> _cancel(String creatorId, {bool cancelAtPeriodEnd = false}) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(cancelAtPeriodEnd ? 'Cancel at period end?' : 'Cancel membership?'),
        content: Text(
          cancelAtPeriodEnd
              ? 'You keep access until the end of your billing period.'
              : 'You may lose access to member-only content immediately.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final client = ref.read(apiClientProvider);
      final qs = cancelAtPeriodEnd ? '?cancelAtPeriodEnd=true' : '';
      await client.dio.delete('/subscriptions/me/$creatorId$qs');
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              cancelAtPeriodEnd
                  ? 'Membership will cancel at period end'
                  : 'Membership canceled',
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not cancel membership')),
        );
      }
    }
  }

  Future<void> _promptCancel(String creatorId, {String? source}) async {
    final isStripe = source == 'stripe';
    if (!isStripe) {
      await _cancel(creatorId);
      return;
    }
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel membership'),
        content: const Text('Choose when to cancel your Stripe subscription.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'period_end'),
            child: const Text('At period end'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'now'),
            child: const Text('Cancel now'),
          ),
        ],
      ),
    );
    if (choice == 'period_end') {
      await _cancel(creatorId, cancelAtPeriodEnd: true);
    } else if (choice == 'now') {
      await _cancel(creatorId);
    }
  }

  Future<void> _changeTier(String creatorId, String tierId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/billing/subscriptions/change-tier', data: {
        'creatorId': creatorId,
        'tierId': tierId,
      });
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tier updated')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not change tier')),
        );
      }
    }
  }

  Future<List<Map<String, dynamic>>> _fetchTiers(String creatorId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/$creatorId/tiers');
      return (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (_) {
      return [];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My memberships')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _subscriptions.isEmpty
              ? const Center(child: Text('No active memberships yet'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    OutlinedButton(
                      onPressed: _openBillingPortal,
                      child: const Text('Manage billing (Stripe portal)'),
                    ),
                    const SizedBox(height: 16),
                    ..._subscriptions.map((sub) {
                      final creator = sub['creator'] as Map<String, dynamic>?;
                      final tier = sub['tier'] as Map<String, dynamic>?;
                      final creatorId = sub['creatorId'] as String?;
                      final tierId = sub['tierId'] as String?;
                      final status = sub['status'] as String? ?? '';
                      final source = sub['source'] as String?;
                      final isRenewalPending = status == 'renewal_pending';
                      final username = creator?['username'] as String?;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                creator?['displayName'] as String? ??
                                    username ??
                                    'Creator',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Text(
                                tier?['name'] as String? ?? 'Member',
                                style: TextStyle(
                                  color: ForgeTokens.of(context).onSurfaceVariant,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                status.replaceAll('_', ' ').toUpperCase(),
                                style: TextStyle(
                                  color: ForgeTokens.of(context).primary,
                                  fontSize: 11,
                                ),
                              ),
                              if (isRenewalPending)
                                Padding(
                                  padding: EdgeInsets.only(top: 4),
                                  child: Text(
                                    'Cancels at end of billing period',
                                    style: TextStyle(
                                      color: ForgeTokens.of(context).onSurfaceVariant,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: [
                                  if (username != null || creatorId != null)
                                    TextButton(
                                      onPressed: () => context.push('/community/${creatorId ?? ''}'),
                                      child: const Text('Open community'),
                                    ),
                                  if (!isRenewalPending)
                                    TextButton(
                                      onPressed: creatorId == null
                                          ? null
                                          : () => _promptCancel(creatorId, source: source),
                                      child: Text('Cancel', style: TextStyle(color: ForgeTokens.of(context).error)),
                                    ),
                                ],
                              ),
                              if (creatorId != null && !isRenewalPending)
                                FutureBuilder<List<Map<String, dynamic>>>(
                                  future: _fetchTiers(creatorId),
                                  builder: (context, snap) {
                                    final tiers = (snap.data ?? [])
                                        .where((t) => t['id'] != tierId)
                                        .toList();
                                    if (tiers.isEmpty) return const SizedBox.shrink();
                                    return DropdownButtonFormField<String>(
                                      decoration: const InputDecoration(
                                        labelText: 'Change tier',
                                        isDense: true,
                                      ),
                                      items: tiers
                                          .map(
                                            (t) => DropdownMenuItem(
                                              value: t['id'] as String,
                                              child: Text(t['name'] as String? ?? ''),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (newTierId) {
                                        if (newTierId != null) {
                                          _changeTier(creatorId, newTierId);
                                        }
                                      },
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                ),
    );
  }
}
