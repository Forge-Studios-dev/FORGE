import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/widgets/forge_button.dart';

class StudioBrandsScreen extends ConsumerStatefulWidget {
  const StudioBrandsScreen({super.key});

  @override
  ConsumerState<StudioBrandsScreen> createState() => _StudioBrandsScreenState();
}

class _StudioBrandsScreenState extends ConsumerState<StudioBrandsScreen> {
  final _nameCtrl = TextEditingController();
  final _slugCtrl = TextEditingController();
  List<Map<String, dynamic>> _brands = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/me/brands');
      setState(() {
        _brands = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createBrand() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/brands', data: {
        'name': name,
        if (_slugCtrl.text.trim().isNotEmpty) 'slug': _slugCtrl.text.trim(),
      });
      _nameCtrl.clear();
      _slugCtrl.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Brand created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create brand')),
        );
      }
    }
  }

  Future<void> _deleteBrand(String id) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/brands/$id');
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete brand')),
        );
      }
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _slugCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Brands'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Brand name'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _slugCtrl,
                  decoration: const InputDecoration(labelText: 'Slug (optional)'),
                ),
                const SizedBox(height: 12),
                ForgeButton(label: 'Create brand', onPressed: _createBrand),
                const SizedBox(height: 24),
                ..._brands.map(
                  (b) => Card(
                    child: ListTile(
                      title: Text(b['name']?.toString() ?? ''),
                      subtitle: Text(b['slug']?.toString() ?? ''),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => _deleteBrand(b['id'] as String),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
