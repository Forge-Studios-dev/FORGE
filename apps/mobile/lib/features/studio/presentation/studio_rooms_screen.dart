import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_client.dart';
import '../../../core/platform/platform_config.dart';

class StudioRoomsScreen extends ConsumerStatefulWidget {
  const StudioRoomsScreen({super.key});

  @override
  ConsumerState<StudioRoomsScreen> createState() => _StudioRoomsScreenState();
}

class _StudioRoomsScreenState extends ConsumerState<StudioRoomsScreen> {
  List<Map<String, dynamic>> _communities = [];
  String? _communityId;
  List<Map<String, dynamic>> _rooms = [];
  final _nameCtrl = TextEditingController();
  String _roomType = 'text';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCommunities();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCommunities() async {
    setState(() => _loading = true);
    try {
      final client = ref.read(apiClientProvider);
      final me = await client.dio.get('/users/me');
      final creatorId = me.data['data']?['id'] as String?;
      if (creatorId == null) return;
      final res = await client.dio.get('/creators/$creatorId/communities');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _communities = list;
        _communityId = list.isNotEmpty ? list.first['id'] as String? : null;
      });
      if (_communityId != null) await _loadRooms();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadRooms() async {
    if (_communityId == null) return;
    final client = ref.read(apiClientProvider);
    final res = await client.dio.get('/communities/$_communityId/rooms');
    setState(() {
      _rooms = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    });
  }

  Future<void> _createRoom() async {
    if (_communityId == null || _nameCtrl.text.trim().isEmpty) return;
    final client = ref.read(apiClientProvider);
    await client.dio.post('/creators/me/communities/$_communityId/rooms', data: {
      'name': _nameCtrl.text.trim(),
      'roomType': _roomType,
    });
    _nameCtrl.clear();
    await _loadRooms();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Room created')),
      );
    }
  }

  Future<void> _deactivateRoom(String roomId) async {
    if (_communityId == null) return;
    final client = ref.read(apiClientProvider);
    await client.dio.delete('/creators/me/communities/$_communityId/rooms/$roomId');
    await _loadRooms();
  }

  Future<void> _openRoom(String roomId, String roomType) async {
    if (_communityId == null) return;
    var webBase = AppConstants.webBaseUrl;
    try {
      final config = await ref.read(platformConfigProvider.future);
      final fromConfig = config['webUrl'] as String?;
      if (fromConfig != null && fromConfig.isNotEmpty) {
        webBase = fromConfig;
      }
    } catch (_) {}
    final path = roomType == 'text' ? 'text' : 'voice';
    final uri = Uri.parse('$webBase/community/$_communityId/$path/$roomId');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Open FORGE on web to join this room')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Community rooms')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_communities.length > 1)
                  DropdownButtonFormField<String>(
                    value: _communityId,
                    decoration: const InputDecoration(labelText: 'Community'),
                    items: _communities
                        .map((c) => DropdownMenuItem(
                              value: c['id'] as String,
                              child: Text(c['name'] as String? ?? 'Community'),
                            ))
                        .toList(),
                    onChanged: (v) async {
                      setState(() => _communityId = v);
                      await _loadRooms();
                    },
                  ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Room name'),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: _roomType,
                  decoration: const InputDecoration(labelText: 'Room type'),
                  items: const [
                    DropdownMenuItem(value: 'text', child: Text('Text')),
                    DropdownMenuItem(value: 'voice', child: Text('Voice')),
                    DropdownMenuItem(value: 'stage', child: Text('Stage')),
                  ],
                  onChanged: (v) => setState(() => _roomType = v ?? 'text'),
                ),
                const SizedBox(height: 12),
                FilledButton(onPressed: _createRoom, child: const Text('Create room')),
                const SizedBox(height: 24),
                const Text('Active rooms', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                ..._rooms.map(
                  (r) {
                    final roomId = r['id'] as String?;
                    final roomType = r['roomType'] as String? ?? 'text';
                    return Card(
                      child: ListTile(
                        title: Text(r['name'] as String? ?? 'Room'),
                        subtitle: Text(roomType),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (roomId != null)
                              IconButton(
                                icon: const Icon(Icons.open_in_browser),
                                tooltip: 'Open room',
                                onPressed: () => _openRoom(roomId, roomType),
                              ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: roomId == null ? null : () => _deactivateRoom(roomId),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
    );
  }
}
