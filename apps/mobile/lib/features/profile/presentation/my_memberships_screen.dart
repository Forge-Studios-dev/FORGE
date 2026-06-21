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

  Future<void> _cancel(String creatorId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel membership?'),
        content: const Text('You may lose access to member-only content.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cancel')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/subscriptions/me/$creatorId');
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not cancel membership')),
        );
      }
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
                                style: const TextStyle(
                                  color: ForgeTokens.onSurfaceVariant,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                (sub['status'] as String? ?? '').toUpperCase(),
                                style: TextStyle(
                                  color: ForgeTokens.primary,
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                children: [
                                  if (username != null)
                                    TextButton(
                                      onPressed: () => context.push('/community/${sub['creatorId']}'),
                                      child: const Text('Open community'),
                                    ),
                                  TextButton(
                                    onPressed: creatorId == null ? null : () => _cancel(creatorId),
                                    child: const Text('Cancel', style: TextStyle(color: Colors.red)),
                                  ),
                                ],
                              ),
                              if (creatorId != null)
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
