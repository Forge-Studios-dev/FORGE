import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_empty_state.dart';
import '../../auth/data/auth_repository.dart';
import '../data/profile_repository.dart';

class StrikesScreen extends ConsumerStatefulWidget {
  const StrikesScreen({super.key});

  @override
  ConsumerState<StrikesScreen> createState() => _StrikesScreenState();
}

class _StrikesScreenState extends ConsumerState<StrikesScreen> {
  List<Map<String, dynamic>> _strikes = [];
  bool _loading = true;
  bool _guest = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final loggedIn = await ref.read(authRepositoryProvider).isLoggedIn();
    if (!mounted) return;
    if (!loggedIn) {
      setState(() {
        _guest = true;
        _loading = false;
      });
      return;
    }
    setState(() => _guest = false);
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final strikes = await ref.read(profileRepositoryProvider).getMyStrikes();
      if (mounted) setState(() => _strikes = strikes);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load strikes');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Channel strikes')),
      body: _guest
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Sign in to view strikes on your account.',
                  style: TextStyle(color: t.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
              ),
            )
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(_error!, style: TextStyle(color: t.critical)),
                          const SizedBox(height: 12),
                          FilledButton(onPressed: _load, child: const Text('Retry')),
                        ],
                      ),
                    )
                  : _strikes.isEmpty
                      ? const ForgeEmptyState(
                          icon: Icons.verified_outlined,
                          title: 'No strikes on your account',
                          description:
                              'Community guideline and copyright strikes will show up here.',
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          child: ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _strikes.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              return _StrikeCard(
                                strike: _strikes[index],
                                onChanged: _load,
                              );
                            },
                          ),
                        ),
    );
  }
}

class _StrikeCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> strike;
  final VoidCallback onChanged;

  const _StrikeCard({required this.strike, required this.onChanged});

  @override
  ConsumerState<_StrikeCard> createState() => _StrikeCardState();
}

class _StrikeCardState extends ConsumerState<_StrikeCard> {
  bool _expanded = false;
  bool _appealOpen = false;
  bool _counterOpen = false;
  bool _counterSubmitting = false;
  bool _goodFaith = false;
  bool _jurisdiction = false;
  final _appealController = TextEditingController();
  final _contactController = TextEditingController();
  final _signatureController = TextEditingController();
  Map<String, dynamic>? _notice;
  bool _noticeLoading = false;

  @override
  void dispose() {
    _appealController.dispose();
    _contactController.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  Future<void> _loadNotice(String noticeId) async {
    setState(() => _noticeLoading = true);
    try {
      final notice = await ref.read(profileRepositoryProvider).getCopyrightNotice(noticeId);
      if (mounted) setState(() => _notice = notice);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not load claim details')),
        );
      }
    } finally {
      if (mounted) setState(() => _noticeLoading = false);
    }
  }

  Future<void> _submitAppeal(String strikeId) async {
    final reason = _appealController.text.trim();
    if (reason.length < 10) return;
    try {
      await ref.read(profileRepositoryProvider).appealStrike(strikeId, reason);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Appeal submitted')),
        );
        setState(() => _appealOpen = false);
        widget.onChanged();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit appeal')),
        );
      }
    }
  }

  Future<void> _submitCounterNotice(String noticeId) async {
    final contact = _contactController.text.trim();
    final signature = _signatureController.text.trim();
    if (contact.length < 10 || signature.length < 2 || !_goodFaith || !_jurisdiction) {
      return;
    }
    setState(() => _counterSubmitting = true);
    try {
      await ref.read(profileRepositoryProvider).fileCounterNotice(
            noticeId,
            contactInfo: contact,
            goodFaith: _goodFaith,
            jurisdiction: _jurisdiction,
            signature: signature,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Counter-notice submitted')),
        );
        setState(() {
          _counterOpen = false;
          _notice = null;
        });
        await _loadNotice(noticeId);
        widget.onChanged();
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not submit counter-notice')),
        );
      }
    } finally {
      if (mounted) setState(() => _counterSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final s = widget.strike;
    final typeRaw = s['type'] as String? ?? '';
    final type = typeRaw.replaceAll('_', ' ');
    final status = s['status'] as String? ?? 'active';
    final appealStatus = s['appealStatus'] as String? ?? 'none';
    final canAppeal = status == 'active' && appealStatus == 'none';
    // Copyright strikes store the DMCA notice id in sourceReportId (API convention).
    final noticeId = s['sourceReportId'] as String?;
    final noticeStatus = _notice?['status'] as String?;
    final canCounterNotice = noticeStatus == 'takedown_issued';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('$type strike', style: Theme.of(context).textTheme.titleSmall),
                      const SizedBox(height: 4),
                      Text(s['reason'] as String? ?? '', style: TextStyle(color: t.onSurfaceVariant)),
                    ],
                  ),
                ),
                Chip(
                  label: Text(status, style: const TextStyle(fontSize: 11)),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            if (appealStatus != 'none')
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Appeal $appealStatus', style: TextStyle(fontSize: 12, color: t.onSurfaceVariant)),
              ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (typeRaw == 'copyright' && noticeId != null)
                  TextButton(
                    onPressed: () async {
                      final next = !_expanded;
                      setState(() => _expanded = next);
                      if (next && _notice == null) await _loadNotice(noticeId);
                    },
                    child: Text(_expanded ? 'Hide claim details' : 'View claim details'),
                  ),
                if (canAppeal && !_appealOpen)
                  TextButton(
                    onPressed: () => setState(() => _appealOpen = true),
                    child: const Text('Appeal this strike'),
                  ),
              ],
            ),
            if (_expanded && noticeId != null) ...[
              const SizedBox(height: 8),
              if (_noticeLoading)
                const LinearProgressIndicator()
              else if (_notice != null) ...[
                Text(
                  'Claimant: ${_notice!['claimantName']}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  _notice!['workDescription'] as String? ?? '',
                  style: TextStyle(color: t.onSurfaceVariant, fontSize: 13),
                ),
                if ((_notice!['infringingDescription'] as String?)?.isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    _notice!['infringingDescription'] as String,
                    style: TextStyle(color: t.onSurfaceVariant, fontSize: 13),
                  ),
                ],
                if (canCounterNotice && !_counterOpen) ...[
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => setState(() => _counterOpen = true),
                    child: const Text('File a counter-notice'),
                  ),
                ],
                if (!canCounterNotice && noticeStatus != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    noticeStatus == 'counter_noticed'
                        ? 'Counter-notice filed — pending the claimant response window.'
                        : noticeStatus == 'reinstated'
                            ? 'This claim was resolved and the video was reinstated.'
                            : 'This claim has been resolved.',
                    style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                  ),
                ],
                if (_counterOpen) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Filing a false counter-notice can expose you to legal liability. '
                    'Only proceed if you believe this video was removed by mistake or misidentification.',
                    style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _contactController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Contact information',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _goodFaith,
                    onChanged: (v) => setState(() => _goodFaith = v ?? false),
                    title: const Text(
                      'I have a good-faith belief the material was removed by mistake or misidentification',
                      style: TextStyle(fontSize: 13),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _jurisdiction,
                    onChanged: (v) => setState(() => _jurisdiction = v ?? false),
                    title: const Text(
                      'I consent to the jurisdiction of the federal district court for my address',
                      style: TextStyle(fontSize: 13),
                    ),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  TextField(
                    controller: _signatureController,
                    decoration: const InputDecoration(
                      labelText: 'Electronic signature (full name)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      FilledButton(
                        onPressed: _counterSubmitting
                            ? null
                            : () => _submitCounterNotice(noticeId),
                        child: Text(_counterSubmitting ? 'Submitting…' : 'Submit counter-notice'),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: _counterSubmitting
                            ? null
                            : () => setState(() => _counterOpen = false),
                        child: const Text('Cancel'),
                      ),
                    ],
                  ),
                ],
              ],
            ],
            if (_appealOpen) ...[
              const SizedBox(height: 8),
              TextField(
                controller: _appealController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Explain why you believe this strike was issued in error…',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => _submitAppeal(s['id'] as String),
                child: const Text('Submit appeal'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
