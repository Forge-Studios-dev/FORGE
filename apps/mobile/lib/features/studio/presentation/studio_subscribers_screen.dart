import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/utils/csv_export_util.dart';
import '../../../core/widgets/forge_card.dart';
import '../../auth/data/auth_repository.dart';

class StudioSubscribersScreen extends ConsumerStatefulWidget {
  const StudioSubscribersScreen({super.key});

  @override
  ConsumerState<StudioSubscribersScreen> createState() => _StudioSubscribersScreenState();
}

class _StudioSubscribersScreenState extends ConsumerState<StudioSubscribersScreen> {
  List<Map<String, dynamic>> _subscribers = [];
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _communities = [];
  String? _grantUserId;
  final _grantUserIdCtrl = TextEditingController();
  String? _grantTierId;
  String? _grantCommunityId;
  final _grantDaysCtrl = TextEditingController(text: '30');
  bool _loading = true;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _grantDaysCtrl.dispose();
    _grantUserIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      final creatorId = user?['id'] as String?;
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/me/subscribers');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      if (creatorId != null) {
        final tiersRes = await client.dio.get('/creators/$creatorId/tiers');
        final commRes = await client.dio.get('/creators/$creatorId/communities');
        setState(() {
          _tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          _communities = (commRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        });
      }
      setState(() {
        _subscribers = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _suspend(String subscriptionId) async {
    final client = ref.read(apiClientProvider);
    await client.dio.post('/creators/me/subscribers/$subscriptionId/suspend');
    await _load();
  }

  Future<void> _grant() async {
    final userId = _grantUserId ?? _grantUserIdCtrl.text.trim();
    if (userId.isEmpty || _grantTierId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/subscribers/grant', data: {
        'userId': userId,
        'tierId': _grantTierId,
        if (_grantCommunityId != null) 'communityId': _grantCommunityId,
        'expiresInDays': int.tryParse(_grantDaysCtrl.text.trim()) ?? 30,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Membership granted')),
        );
      }
      setState(() {
        _grantUserId = null;
        _grantUserIdCtrl.clear();
      });
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not grant membership')),
        );
      }
    }
  }

  Future<void> _exportCsv() async {
    setState(() => _exporting = true);
    try {
      final client = ref.read(apiClientProvider);
      await CsvExportUtil.downloadAndShare(
        dio: client.dio,
        apiPath: '/creators/me/subscribers/export',
        filename: 'subscribers.csv',
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not export subscribers')),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Subscribers'),
        actions: [
          TextButton.icon(
            onPressed: _loading || _exporting ? null : _exportCsv,
            icon: _exporting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download_outlined, size: 18),
            label: Text(_exporting ? 'Exporting…' : 'Export CSV'),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ForgeCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Grant complimentary access', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: _grantUserId,
                        decoration: const InputDecoration(labelText: 'Member'),
                        items: _subscribers
                            .map(
                              (s) => DropdownMenuItem(
                                value: s['userId'] as String?,
                                child: Text(
                                  s['displayName'] as String? ??
                                      s['username'] as String? ??
                                      s['userId'] as String? ??
                                      'Member',
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _grantUserId = v),
                      ),
                      TextField(
                        controller: _grantUserIdCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Or enter user UUID',
                        ),
                        onChanged: (_) => setState(() => _grantUserId = null),
                      ),
                      DropdownButtonFormField<String>(
                        value: _grantTierId,
                        decoration: const InputDecoration(labelText: 'Tier'),
                        items: _tiers
                            .map(
                              (t) => DropdownMenuItem(
                                value: t['id'] as String?,
                                child: Text(t['name'] as String? ?? 'Tier'),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _grantTierId = v),
                      ),
                      DropdownButtonFormField<String>(
                        value: _grantCommunityId,
                        decoration: const InputDecoration(labelText: 'Community scope (optional)'),
                        items: [
                          const DropdownMenuItem(value: null, child: Text('Creator-wide')),
                          ..._communities.map(
                            (c) => DropdownMenuItem(
                              value: c['id'] as String?,
                              child: Text(c['name'] as String? ?? 'Community'),
                            ),
                          ),
                        ],
                        onChanged: (v) => setState(() => _grantCommunityId = v),
                      ),
                      TextField(
                        controller: _grantDaysCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Expires in days'),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: (_grantUserId != null || _grantUserIdCtrl.text.trim().isNotEmpty) &&
                                _grantTierId != null
                            ? _grant
                            : null,
                        child: const Text('Grant membership'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ..._subscribers.map((s) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: ForgeCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  s['displayName'] as String? ??
                                      s['username'] as String? ??
                                      s['userId'] as String? ??
                                      'Member',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                Text(
                                  '${s['tierName'] ?? 'Tier'} · ${s['status']}',
                                  style: TextStyle(fontSize: 12, color: ForgeTokens.of(context).onSurfaceVariant),
                                ),
                              ],
                            ),
                          ),
                          if (s['status'] == 'active')
                            TextButton(
                              onPressed: () => _suspend(s['id'] as String),
                              child: const Text('Suspend'),
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
