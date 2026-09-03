import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/access/forge_access.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../auth/data/auth_repository.dart';
import '../../live/data/live_repository.dart';

/// Studio go-live setup — parity with web `/studio/live`.
class StudioLiveScreen extends ConsumerStatefulWidget {
  const StudioLiveScreen({super.key});

  @override
  ConsumerState<StudioLiveScreen> createState() => _StudioLiveScreenState();
}

class _StudioLiveScreenState extends ConsumerState<StudioLiveScreen> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _ticketCtrl = TextEditingController();

  String _visibility = 'public';
  String? _communityId;
  String? _creatorId;
  String? _requiredTierId;
  String? _categoryId;
  DateTime? _scheduledAt;
  bool _scheduleEnabled = false;

  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _tiers = [];
  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _liveNow = [];
  List<Map<String, dynamic>> _upcoming = [];
  List<Map<String, dynamic>> _recentEnded = [];

  bool _chatEnabled = true;
  bool _recordEnabled = true;
  bool _dvrEnabled = false;
  bool _ageRestricted = false;
  bool _loading = false;
  bool _loadingMeta = true;
  bool _canGoLive = false;
  String? _error;

  static const _visibilityOptions = <({String value, String label})>[
    (value: 'public', label: 'Public'),
    (value: 'followers', label: 'Subscribers'),
    (value: 'subscribers', label: 'Members'),
    (value: 'tier', label: 'Tier members'),
    (value: 'private', label: 'Private'),
    (value: 'paid_event', label: 'Paid event'),
  ];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      _creatorId = user?['id'] as String?;
      final tier = ForgeAccess.tierFromUser(user, hasSession: user != null);
      _canGoLive = ForgeAccess.canGoLive(tier) || ForgeAccess.isPlatformAdmin(tier);

      if (_creatorId == null) {
        setState(() => _loadingMeta = false);
        return;
      }

      final client = ref.read(apiClientProvider);
      final liveRepo = ref.read(liveRepositoryProvider);

      Future<List<Map<String, dynamic>>> asMapList(Future<Response<dynamic>> fut) async {
        try {
          final res = await fut;
          return (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        } catch (_) {
          return [];
        }
      }

      Future<List<Map<String, dynamic>>> safeLiveList(
        Future<List<Map<String, dynamic>>> fut,
      ) async {
        try {
          return await fut;
        } catch (_) {
          return [];
        }
      }

      final results = await Future.wait([
        asMapList(client.dio.get('/creators/$_creatorId/communities')),
        asMapList(client.dio.get('/creators/$_creatorId/tiers')),
        asMapList(client.dio.get('/categories')),
        safeLiveList(liveRepo.getLiveStreams(creatorId: _creatorId)),
        safeLiveList(liveRepo.getUpcomingStreams(creatorId: _creatorId)),
        asMapList(client.dio.get('/creators/me/streams/recent')),
      ]);

      if (!mounted) return;

      final communities = results[0];
      final tiers = results[1];
      final categories = results[2];
      final liveNow = results[3];
      final upcoming = results[4];
      final recent = results[5];

      setState(() {
        _communities = communities;
        if (communities.length == 1) _communityId = communities.first['id'] as String?;
        _tiers = tiers;
        _categories = categories;
        _liveNow = liveNow;
        _upcoming = upcoming;
        _recentEnded = recent;
        _loadingMeta = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMeta = false);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _ticketCtrl.dispose();
    super.dispose();
  }

  String? _messageFromDio(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map) {
        final m = data['message'];
        if (m is String) return m;
        if (m is List) return m.map((x) => '$x').join(', ');
      }
    }
    return null;
  }

  Future<void> _pickSchedule() async {
    final now = DateTime.now();
    final initial = _scheduledAt ?? now.add(const Duration(hours: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial.isBefore(now) ? now.add(const Duration(days: 1)) : initial,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;
    final picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    if (picked.isBefore(now.add(const Duration(minutes: 15)))) {
      setState(() => _error = 'Schedule at least 15 minutes from now.');
      return;
    }
    setState(() {
      _scheduledAt = picked;
      _scheduleEnabled = true;
      _error = null;
    });
  }

  Future<void> _start() async {
    if (!_canGoLive) return;
    final title = _titleCtrl.text.trim();
    if (title.length < 3) {
      setState(() => _error = 'Title needs at least 3 characters.');
      return;
    }
    if (_visibility == 'tier' && (_requiredTierId == null || _requiredTierId!.isEmpty)) {
      setState(() => _error = 'Select a membership tier for tier-only streams.');
      return;
    }
    if (_visibility == 'paid_event') {
      final dollars = double.tryParse(_ticketCtrl.text.trim());
      if (dollars == null || dollars < 1) {
        setState(() => _error = 'Paid events need a ticket price of at least \$1.00.');
        return;
      }
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ticketCents = _visibility == 'paid_event'
          ? ((double.parse(_ticketCtrl.text.trim()) * 100).round())
          : null;
      final data = await ref.read(liveRepositoryProvider).startStream({
        'title': title,
        if (_descCtrl.text.trim().isNotEmpty) 'description': _descCtrl.text.trim(),
        'visibility': _visibility,
        if (_visibility == 'tier') 'requiredTierId': _requiredTierId,
        if (_categoryId != null && _categoryId!.isNotEmpty) 'categoryId': _categoryId,
        'chatEnabled': _chatEnabled,
        'recordEnabled': _recordEnabled,
        'dvrEnabled': _dvrEnabled,
        'ageRestricted': _ageRestricted,
        if (_scheduleEnabled && _scheduledAt != null)
          'scheduledAt': _scheduledAt!.toUtc().toIso8601String(),
        if (ticketCents != null) 'ticketPriceCents': ticketCents,
        if (_communityId != null) 'communityId': _communityId,
      });
      final streamId = data['id'] as String?;
      if (!mounted) return;
      if (streamId != null) {
        context.go('/live/$streamId');
      } else {
        context.go('/live');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = _messageFromDio(e) ??
            'Could not start stream. Verify creator approval, email verification, and Mux configuration.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_error ?? 'Could not start stream')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: ForgeTokens.of(context).onSurface,
        ),
      ),
    );
  }

  Widget _streamTile(Map<String, dynamic> stream, {required String subtitle}) {
    final id = stream['id'] as String?;
    final title = stream['title'] as String? ?? 'Stream';
    if (id == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: ForgeCard(
        onTap: () => context.push('/live/$id'),
        child: Row(
          children: [
            Icon(Icons.sensors, color: ForgeTokens.of(context).primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: ForgeTokens.of(context).onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: ForgeTokens.of(context).outline),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Go live'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Set up your session, choose who can join, then open the host control room.',
            style: TextStyle(color: t.onSurfaceVariant, height: 1.5),
          ),
          const SizedBox(height: 16),
          if (_loadingMeta) const LinearProgressIndicator(),
          if (!_canGoLive && !_loadingMeta) ...[
            ForgeCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Creator approval required',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Go live is available after your channel is approved and email is verified.',
                    style: TextStyle(color: t.onSurfaceVariant, height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  ForgeButton(
                    label: 'Open Studio',
                    onPressed: () => context.go('/studio'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => context.go('/waiting-approval'),
                    child: const Text('Check approval status'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
          if (_canGoLive) ...[
            if (_error != null) ...[
              Text(_error!, style: TextStyle(color: t.error, fontSize: 13)),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _titleCtrl,
              decoration: const InputDecoration(
                labelText: 'Session title',
                hintText: 'e.g. Live wheel throwing basics',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
              maxLines: 2,
            ),
            const SizedBox(height: 12),
            if (_communities.isNotEmpty)
              DropdownButtonFormField<String?>(
                value: _communityId,
                decoration: const InputDecoration(
                  labelText: 'Link to community (optional)',
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No community link')),
                  ..._communities.map(
                    (c) => DropdownMenuItem(
                      value: c['id'] as String,
                      child: Text(c['name'] as String? ?? 'Community'),
                    ),
                  ),
                ],
                onChanged: (v) => setState(() => _communityId = v),
              ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _visibility,
              decoration: const InputDecoration(labelText: 'Visibility'),
              items: _visibilityOptions
                  .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                  .toList(),
              onChanged: (v) => setState(() {
                _visibility = v ?? 'public';
                if (_visibility != 'tier') _requiredTierId = null;
              }),
            ),
            if (_visibility == 'tier') ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                value: _requiredTierId,
                decoration: const InputDecoration(labelText: 'Required tier'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Select tier')),
                  ..._tiers.map(
                    (tier) => DropdownMenuItem(
                      value: tier['id'] as String?,
                      child: Text(tier['name'] as String? ?? 'Tier'),
                    ),
                  ),
                ],
                onChanged: (v) => setState(() => _requiredTierId = v),
              ),
            ],
            if (_visibility == 'paid_event') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _ticketCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Ticket price (USD)',
                  hintText: '1.00',
                  prefixText: '\$ ',
                ),
              ),
            ],
            if (_categories.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                value: _categoryId,
                decoration: const InputDecoration(labelText: 'Category (optional)'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('No category')),
                  ..._categories.map(
                    (c) => DropdownMenuItem(
                      value: c['id'] as String?,
                      child: Text(c['name'] as String? ?? 'Category'),
                    ),
                  ),
                ],
                onChanged: (v) => setState(() => _categoryId = v),
              ),
            ],
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Schedule for later'),
              subtitle: Text(
                _scheduleEnabled && _scheduledAt != null
                    ? _scheduledAt!.toLocal().toString()
                    : 'Start immediately',
                style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
              ),
              value: _scheduleEnabled,
              onChanged: (on) {
                setState(() {
                  _scheduleEnabled = on;
                  if (on && _scheduledAt == null) {
                    _scheduledAt = DateTime.now().add(const Duration(hours: 1));
                  }
                });
                if (on) _pickSchedule();
              },
            ),
            if (_scheduleEnabled)
              TextButton.icon(
                onPressed: _pickSchedule,
                icon: const Icon(Icons.event, size: 18),
                label: const Text('Pick date & time'),
              ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Chat enabled'),
              value: _chatEnabled,
              onChanged: (v) => setState(() => _chatEnabled = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Record VOD'),
              value: _recordEnabled,
              onChanged: (v) => setState(() => _recordEnabled = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('DVR (rewind while live)'),
              value: _dvrEnabled,
              onChanged: (v) => setState(() => _dvrEnabled = v),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Age restricted'),
              value: _ageRestricted,
              onChanged: (v) => setState(() => _ageRestricted = v),
            ),
            const SizedBox(height: 16),
            ForgeButton(
              label: _loading
                  ? 'Starting…'
                  : (_scheduleEnabled ? 'Schedule stream' : 'Go live'),
              onPressed: _loading ? null : _start,
            ),
          ],
          if (_liveNow.isNotEmpty) ...[
            const SizedBox(height: 28),
            _sectionTitle('Live now'),
            ..._liveNow.map(
              (s) => _streamTile(
                s,
                subtitle: '${s['viewerCount'] ?? s['uniqueViewerCount'] ?? 0} watching',
              ),
            ),
          ],
          if (_upcoming.isNotEmpty) ...[
            const SizedBox(height: 20),
            _sectionTitle('Scheduled'),
            ..._upcoming.map((s) {
              final at = s['scheduledAt'] as String?;
              final label = at != null
                  ? 'Starts ${DateTime.tryParse(at)?.toLocal() ?? at}'
                  : 'Upcoming';
              return _streamTile(s, subtitle: label);
            }),
          ],
          const SizedBox(height: 24),
          ForgeCard(
            onTap: () => context.go('/live'),
            child: Row(
              children: [
                Icon(Icons.live_tv, color: t.primary),
                const SizedBox(width: 12),
                const Expanded(child: Text('Browse live sessions')),
                Icon(Icons.chevron_right, color: t.outline),
              ],
            ),
          ),
          if (_recentEnded.isNotEmpty) ...[
            const SizedBox(height: 28),
            _sectionTitle('Recent sessions'),
            ..._recentEnded.map((stream) {
              final id = stream['id'] as String?;
              final title = stream['title'] as String? ?? 'Ended session';
              if (id == null) return const SizedBox.shrink();
              final endedAt = stream['endedAt'] as String?;
              final viewers = stream['uniqueViewerCount'];
              final meta = [
                if (endedAt != null) DateTime.tryParse(endedAt)?.toLocal().toString().split('.').first,
                if (viewers != null) '$viewers viewers',
              ].whereType<String>().join(' · ');
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ForgeCard(
                  onTap: () => context.push('/studio/live/$id/debrief'),
                  child: Row(
                    children: [
                      Icon(Icons.analytics_outlined, color: t.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                            if (meta.isNotEmpty)
                              Text(
                                meta,
                                style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                              ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right, color: t.outline),
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
