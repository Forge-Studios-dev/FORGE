import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class StudioModerationScreen extends ConsumerStatefulWidget {
  const StudioModerationScreen({super.key});

  @override
  ConsumerState<StudioModerationScreen> createState() => _StudioModerationScreenState();
}

class _StudioModerationScreenState extends ConsumerState<StudioModerationScreen> {
  List<Map<String, dynamic>> _communities = [];
  String? _selectedCommunityId;
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadModerated();
  }

  Future<void> _loadModerated() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/moderated-communities');
      final list = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _communities = list;
        _selectedCommunityId = list.isNotEmpty ? list.first['id'] as String? : null;
        _loading = false;
      });
      if (_selectedCommunityId != null) await _loadReports(_selectedCommunityId!);
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadReports(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.get('/creators/me/communities/$communityId/reports');
      final list = (response.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() => _reports = list);
    } catch (_) {
      setState(() => _reports = []);
    }
  }

  Future<void> _resolve(String communityId, String reportId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.patch('/creators/me/communities/$communityId/reports/$reportId/resolve');
      await _loadReports(communityId);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_communities.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Moderation')),
        body: const Center(child: Text('No moderated communities assigned')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Moderation')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: DropdownButtonFormField<String>(
              value: _selectedCommunityId,
              decoration: const InputDecoration(labelText: 'Community', isDense: true),
              items: _communities
                  .map(
                    (c) => DropdownMenuItem(
                      value: c['id'] as String,
                      child: Text(c['name'] as String? ?? ''),
                    ),
                  )
                  .toList(),
              onChanged: (id) {
                if (id == null) return;
                setState(() => _selectedCommunityId = id);
                _loadReports(id);
              },
            ),
          ),
          Expanded(
            child: _reports.isEmpty
                ? const Center(child: Text('No open reports'))
                : ListView.builder(
                    itemCount: _reports.length,
                    itemBuilder: (_, i) {
                      final r = _reports[i];
                      final communityId = _selectedCommunityId!;
                      return ListTile(
                        title: Text(r['targetType'] as String? ?? 'report'),
                        subtitle: Text(r['reason'] as String? ?? ''),
                        trailing: TextButton(
                          onPressed: () => _resolve(communityId, r['id'] as String),
                          child: const Text('Resolve'),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
