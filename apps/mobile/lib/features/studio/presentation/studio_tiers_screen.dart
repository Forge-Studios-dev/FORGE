import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

class StudioTiersScreen extends ConsumerStatefulWidget {
  const StudioTiersScreen({super.key});

  @override
  ConsumerState<StudioTiersScreen> createState() => _StudioTiersScreenState();
}

class _StudioTiersScreenState extends ConsumerState<StudioTiersScreen> {
  final _nameCtrl = TextEditingController();
  final _priceCtrl = TextEditingController(text: '9900');
  final _benefitsCtrl = TextEditingController();
  final _trialDaysCtrl = TextEditingController(text: '0');
  final _maxDevicesCtrl = TextEditingController(text: '1');
  String _billingInterval = 'monthly';
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _communities = [];
  Map<String, dynamic>? _connectStatus;
  String? _expandedTierId;
  String _entResourceType = 'community';
  String _entResourceId = '';
  bool _loading = true;
  String? _creatorId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _creatorId = user?['id'] as String?;
      if (_creatorId == null) return;
      final client = ref.read(apiClientProvider);
      final tiersRes = await client.dio.get('/creators/$_creatorId/tiers');
      final communitiesRes = await client.dio.get('/creators/$_creatorId/communities');
      try {
        final connectRes = await client.dio.get('/billing/connect/status');
        _connectStatus = connectRes.data['data'] as Map<String, dynamic>?;
      } catch (_) {}
      setState(() {
        _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _communities = (communitiesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _connectStripe() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post(
        '/billing/connect/onboard',
        queryParameters: {'returnUrl': 'forge://studio/tiers'},
      );
      final url = response.data['data']?['url'] as String?;
      if (url != null) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not start Connect onboarding')),
        );
      }
    }
  }

  Future<void> _createTier() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/tiers', data: {
        'name': _nameCtrl.text.trim(),
        'priceCents': int.tryParse(_priceCtrl.text.trim()) ?? 0,
        'billingInterval': _billingInterval,
        'trialDays': int.tryParse(_trialDaysCtrl.text.trim()) ?? 0,
        'maxConcurrentDevices': int.tryParse(_maxDevicesCtrl.text.trim())?.clamp(1, 10) ?? 1,
        'benefits': _benefitsCtrl.text
            .split('\n')
            .map((b) => b.trim())
            .where((b) => b.isNotEmpty)
            .toList(),
      });
      _nameCtrl.clear();
      _benefitsCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Tier created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create tier')),
        );
      }
    }
  }

  Future<void> _addEntitlement(String tierId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/tiers/$tierId/entitlements', data: {
        'resourceType': _entResourceType,
        if (_entResourceId.isNotEmpty) 'resourceId': _entResourceId,
        'accessLevel': 'full',
      });
      _entResourceId = '';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Entitlement added')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not add entitlement')),
        );
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _benefitsCtrl.dispose();
    _trialDaysCtrl.dispose();
    _maxDevicesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connectOk = _connectStatus?['payoutsEnabled'] == true ||
        _connectStatus?['connected'] == true;
    return Scaffold(
      appBar: AppBar(title: const Text('Membership tiers')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Card(
                  child: ListTile(
                    title: const Text('Stripe Connect'),
                    subtitle: Text(
                      connectOk
                          ? 'Payouts enabled — paid checkout available'
                          : 'Complete onboarding to accept paid memberships',
                    ),
                    trailing: connectOk
                        ? const Icon(Icons.check_circle, color: Colors.green)
                        : TextButton(onPressed: _connectStripe, child: const Text('Connect')),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Tier name'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _priceCtrl,
                  decoration: const InputDecoration(labelText: 'Price in cents'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _billingInterval,
                  decoration: const InputDecoration(labelText: 'Billing interval'),
                  items: const [
                    DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                    DropdownMenuItem(value: 'quarterly', child: Text('Quarterly')),
                    DropdownMenuItem(value: 'yearly', child: Text('Yearly')),
                    DropdownMenuItem(value: 'lifetime', child: Text('Lifetime')),
                  ],
                  onChanged: (v) => setState(() => _billingInterval = v ?? 'monthly'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _trialDaysCtrl,
                  decoration: const InputDecoration(labelText: 'Trial days'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _maxDevicesCtrl,
                  decoration: const InputDecoration(labelText: 'Max concurrent devices (1–10)'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _benefitsCtrl,
                  decoration: const InputDecoration(labelText: 'Benefits (one per line)'),
                  maxLines: 3,
                ),
                const SizedBox(height: 12),
                ForgeButton(label: 'Create tier', onPressed: _createTier),
                const SizedBox(height: 24),
                const Text('Your tiers', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ..._tiers.map((t) {
                  final tierId = t['id'] as String;
                  final priceCents = t['priceCents'] as int? ?? 0;
                  final maxDevices = t['maxConcurrentDevices'] as int? ?? 1;
                  final expanded = _expandedTierId == tierId;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      children: [
                        ListTile(
                          title: Text(t['name'] as String? ?? ''),
                          subtitle: Text(
                            '\$${(priceCents / 100).toStringAsFixed(2)} · $maxDevices device(s)',
                            style: const TextStyle(color: ForgeTokens.onSurfaceVariant),
                          ),
                          trailing: Icon(expanded ? Icons.expand_less : Icons.expand_more),
                          onTap: () => setState(
                            () => _expandedTierId = expanded ? null : tierId,
                          ),
                        ),
                        if (expanded) ...[
                          const Divider(height: 1),
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Add entitlement', style: TextStyle(fontSize: 13)),
                                DropdownButtonFormField<String>(
                                  value: _entResourceType,
                                  decoration: const InputDecoration(isDense: true, labelText: 'Resource type'),
                                  items: const [
                                    DropdownMenuItem(value: 'community', child: Text('Community')),
                                    DropdownMenuItem(value: 'channel', child: Text('Channel')),
                                    DropdownMenuItem(value: 'video', child: Text('Video')),
                                    DropdownMenuItem(value: 'creator', child: Text('Creator-wide')),
                                  ],
                                  onChanged: (v) => setState(() => _entResourceType = v ?? 'community'),
                                ),
                                if (_entResourceType == 'community' && _communities.isNotEmpty)
                                  DropdownButtonFormField<String>(
                                    decoration: const InputDecoration(isDense: true, labelText: 'Community'),
                                    items: _communities
                                        .map(
                                          (c) => DropdownMenuItem(
                                            value: c['id'] as String,
                                            child: Text(c['name'] as String? ?? ''),
                                          ),
                                        )
                                        .toList(),
                                    onChanged: (v) => setState(() => _entResourceId = v ?? ''),
                                  )
                                else
                                  TextField(
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      labelText: 'Resource ID (optional for creator-wide)',
                                    ),
                                    onChanged: (v) => _entResourceId = v,
                                  ),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                    onPressed: () => _addEntitlement(tierId),
                                    child: const Text('Add entitlement'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 16),
                TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            ),
    );
  }
}
