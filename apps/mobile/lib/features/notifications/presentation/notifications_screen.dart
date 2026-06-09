import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/notifications');
      setState(() {
        final payload = res.data['data'];
        _items = payload is Map
            ? ((payload['data'] as List?) ?? [])
            : ((payload as List?) ?? []);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: _loading
          ? ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: 4,
              itemBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: ForgeCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(height: 12, width: 120, color: ForgeTokens.surfaceContainerHigh),
                      const SizedBox(height: 8),
                      Container(height: 10, width: double.infinity, color: ForgeTokens.surfaceContainerHigh),
                    ],
                  ),
                ),
              ),
            )
          : _items.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.notifications_none, size: 48, color: ForgeTokens.outline),
                      const SizedBox(height: 12),
                      const Text('No notifications yet', style: TextStyle(color: ForgeTokens.onSurfaceVariant)),
                      const SizedBox(height: 12),
                      TextButton(onPressed: _load, child: const Text('Refresh')),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _items.length,
                  itemBuilder: (_, i) {
                    final n = _items[i] as Map<String, dynamic>;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ForgeCard(
                        child: Text(
                          n['message']?.toString() ?? n['title']?.toString() ?? 'Notification',
                          style: const TextStyle(color: ForgeTokens.onSurface),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
