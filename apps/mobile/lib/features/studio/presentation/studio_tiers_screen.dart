import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
  List<Map<String, dynamic>> _tiers = [];
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
      final response = await client.dio.get('/creators/$_creatorId/tiers');
      setState(() {
        _tiers = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createTier() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/tiers', data: {
        'name': _nameCtrl.text.trim(),
        'priceCents': int.tryParse(_priceCtrl.text.trim()) ?? 0,
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

  @override
  void dispose() {
    _nameCtrl.dispose();
    _priceCtrl.dispose();
    _benefitsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Membership tiers')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Text(
                  'Configure member levels (test billing until payments launch)',
                  style: TextStyle(color: ForgeTokens.onSurfaceVariant, fontSize: 13),
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
                  final priceCents = t['priceCents'] as int? ?? 0;
                  final currency = t['currency'] as String? ?? 'USD';
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(t['name'] as String? ?? ''),
                      subtitle: Text('$currency ${(priceCents / 100).toStringAsFixed(0)}/mo'),
                    ),
                  );
                }),
                TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            ),
    );
  }
}
