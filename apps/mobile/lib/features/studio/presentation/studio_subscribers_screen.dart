import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class StudioSubscribersScreen extends ConsumerStatefulWidget {
  const StudioSubscribersScreen({super.key});

  @override
  ConsumerState<StudioSubscribersScreen> createState() => _StudioSubscribersScreenState();
}

class _StudioSubscribersScreenState extends ConsumerState<StudioSubscribersScreen> {
  List<Map<String, dynamic>> _subscribers = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/me/subscribers');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Subscribers')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _subscribers.length,
              itemBuilder: (_, i) {
                final s = _subscribers[i];
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
                                s['displayName'] as String? ?? s['username'] as String? ?? s['userId'] as String? ?? 'Member',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              Text(
                                '${s['tierName'] ?? 'Tier'} · ${s['status']}',
                                style: const TextStyle(fontSize: 12, color: ForgeTokens.onSurfaceVariant),
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
              },
            ),
    );
  }
}
