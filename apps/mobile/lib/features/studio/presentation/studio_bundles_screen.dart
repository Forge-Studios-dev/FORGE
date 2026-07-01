import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

const _resourceTypes = [
  'community',
  'course',
  'channel',
  'video',
  'stream',
  'event',
  'creator',
];

class StudioBundlesScreen extends ConsumerStatefulWidget {
  const StudioBundlesScreen({super.key});

  @override
  ConsumerState<StudioBundlesScreen> createState() => _StudioBundlesScreenState();
}

class _StudioBundlesScreenState extends ConsumerState<StudioBundlesScreen> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _resourceIdCtrl = TextEditingController();
  List<Map<String, dynamic>> _bundles = [];
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _courses = [];
  final List<Map<String, String?>> _draftItems = [];
  String? _tierId;
  String _resourceType = 'community';
  String? _pickerResourceId;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _resourceIdCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final me = await client.dio.get('/users/me');
      final creatorId = me.data['data']?['id'] as String?;
      final bundlesRes = await client.dio.get('/creators/me/bundles');
      List<Map<String, dynamic>> tiers = [];
      List<Map<String, dynamic>> communities = [];
      List<Map<String, dynamic>> courses = [];
      if (creatorId != null) {
        final tiersRes = await client.dio.get('/creators/$creatorId/tiers');
        tiers = (tiersRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        final communitiesRes = await client.dio.get('/creators/$creatorId/communities');
        communities =
            (communitiesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        try {
          final coursesRes = await client.dio.get('/creators/me/courses');
          courses = (coursesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        } catch (_) {}
      }
      setState(() {
        _bundles = (bundlesRes.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _tiers = tiers;
        _communities = communities;
        _courses = courses;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _addDraftItem() {
    String? resourceId;
    if (_resourceType == 'community') {
      resourceId = _pickerResourceId;
      if (resourceId == null || resourceId.isEmpty) return;
    } else if (_resourceType == 'course') {
      resourceId = _pickerResourceId;
      if (resourceId == null || resourceId.isEmpty) return;
    } else {
      resourceId = _resourceIdCtrl.text.trim().isEmpty ? null : _resourceIdCtrl.text.trim();
    }
    setState(() {
      _draftItems.add({'resourceType': _resourceType, 'resourceId': resourceId});
      _pickerResourceId = null;
      _resourceIdCtrl.clear();
    });
  }

  Future<void> _createBundle() async {
    if (_nameCtrl.text.trim().isEmpty || _tierId == null || _draftItems.isEmpty) return;
    setState(() => _saving = true);
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/bundles', data: {
        'name': _nameCtrl.text.trim(),
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        'tierId': _tierId,
        'items': _draftItems
            .map((item) => {
                  'resourceType': item['resourceType'],
                  'resourceId': item['resourceId'],
                })
            .toList(),
      });
      _nameCtrl.clear();
      _descCtrl.clear();
      _draftItems.clear();
      _tierId = null;
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bundle created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create bundle')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _deactivateBundle(String bundleId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/bundles/$bundleId');
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not deactivate bundle')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Product bundles')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Package community, courses, and more under one membership tier.',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Bundle name'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _descCtrl,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                if (_tiers.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    value: _tierId,
                    decoration: const InputDecoration(labelText: 'Linked tier (billing)'),
                    items: _tiers
                        .map(
                          (t) => DropdownMenuItem<String>(
                            value: t['id'] as String?,
                            child: Text(
                              '${t['name']} — \$${((t['priceCents'] as int? ?? 0) / 100).toStringAsFixed(0)}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _tierId = v),
                  ),
                ],
                const SizedBox(height: 12),
                const Text('Included resources', style: TextStyle(fontWeight: FontWeight.w600)),
                DropdownButtonFormField<String>(
                  value: _resourceType,
                  decoration: const InputDecoration(labelText: 'Resource type'),
                  items: _resourceTypes
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() {
                    _resourceType = v ?? 'community';
                    _pickerResourceId = null;
                    _resourceIdCtrl.clear();
                  }),
                ),
                if (_resourceType == 'community' && _communities.isNotEmpty)
                  DropdownButtonFormField<String>(
                    value: _pickerResourceId,
                    decoration: const InputDecoration(labelText: 'Community'),
                    items: _communities
                        .map(
                          (c) => DropdownMenuItem<String>(
                            value: c['id'] as String?,
                            child: Text(c['name'] as String? ?? 'Community'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _pickerResourceId = v),
                  )
                else if (_resourceType == 'course' && _courses.isNotEmpty)
                  DropdownButtonFormField<String>(
                    value: _pickerResourceId,
                    decoration: const InputDecoration(labelText: 'Course'),
                    items: _courses
                        .map(
                          (c) => DropdownMenuItem<String>(
                            value: c['id'] as String?,
                            child: Text(c['title'] as String? ?? 'Course'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _pickerResourceId = v),
                  )
                else if (_resourceType != 'community' && _resourceType != 'course')
                  TextField(
                    controller: _resourceIdCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Resource ID (optional for creator-wide)',
                    ),
                  ),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: _addDraftItem, child: const Text('Add item')),
                if (_draftItems.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Add at least one resource.',
                      style: TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
                    ),
                  )
                else
                  ..._draftItems.asMap().entries.map((entry) {
                    final item = entry.value;
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${item['resourceType']}${item['resourceId'] != null ? ' · ${(item['resourceId'] as String).substring(0, 8)}…' : ''}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () => setState(() => _draftItems.removeAt(entry.key)),
                      ),
                    );
                  }),
                const SizedBox(height: 12),
                ForgeButton(
                  label: _saving ? 'Creating…' : 'Create bundle',
                  onPressed: _saving ||
                          _nameCtrl.text.trim().isEmpty ||
                          _tierId == null ||
                          _draftItems.isEmpty
                      ? null
                      : _createBundle,
                ),
                const SizedBox(height: 24),
                const Text('Your bundles', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                if (_bundles.isEmpty)
                  const Text('No bundles yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant))
                else
                  ..._bundles.map((bundle) {
                    final id = bundle['id'] as String;
                    final tier = bundle['tier'] as Map<String, dynamic>?;
                    final items = (bundle['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
                    final active = bundle['isActive'] == true;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    bundle['name'] as String? ?? 'Bundle',
                                    style: const TextStyle(fontWeight: FontWeight.w600),
                                  ),
                                ),
                                Text(
                                  active ? 'Active' : 'Inactive',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: active ? ForgeTokens.primary : ForgeTokens.outline,
                                  ),
                                ),
                              ],
                            ),
                            if ((bundle['description'] as String?)?.isNotEmpty == true)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  bundle['description'] as String,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: ForgeTokens.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            if (tier != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Tier: ${tier['name']}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: ForgeTokens.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ...items.map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  '· ${item['resourceType']}${item['resourceId'] != null ? ' · ${item['resourceId']}' : ''}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: ForgeTokens.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ),
                            if (active)
                              TextButton(
                                onPressed: () => _deactivateBundle(id),
                                child: const Text(
                                  'Deactivate',
                                  style: TextStyle(color: Colors.redAccent),
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
  }
}
