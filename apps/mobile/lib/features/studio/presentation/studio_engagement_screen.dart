import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

List<Map<String, dynamic>> _unwrapList(dynamic payload) {
  if (payload is List) {
    return payload
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
  if (payload is Map && payload['data'] != null) {
    return _unwrapList(payload['data']);
  }
  return [];
}

class StudioEngagementScreen extends ConsumerStatefulWidget {
  const StudioEngagementScreen({
    super.key,
    this.embedded = false,
    this.fixedCommunityId,
  });

  final bool embedded;
  final String? fixedCommunityId;

  @override
  ConsumerState<StudioEngagementScreen> createState() => _StudioEngagementScreenState();
}

class _StudioEngagementScreenState extends ConsumerState<StudioEngagementScreen> {
  List<Map<String, dynamic>> _communities = [];
  String? _communityId;
  final _announceTitleCtrl = TextEditingController();
  final _announceBodyCtrl = TextEditingController();
  final _pollQuestionCtrl = TextEditingController();
  final _pollOptionsCtrl = TextEditingController(text: 'Option A\nOption B');
  final _wikiTitleCtrl = TextEditingController();
  final _wikiBodyCtrl = TextEditingController();
  final _challengeTitleCtrl = TextEditingController();
  final _challengeDescCtrl = TextEditingController();
  final _surveyTitleCtrl = TextEditingController();
  final _surveyQuestionsCtrl = TextEditingController(text: 'What do you want to learn?');
  Map<String, dynamic>? _analytics;
  List<Map<String, dynamic>> _wikiPages = [];
  List<Map<String, dynamic>> _challenges = [];
  List<Map<String, dynamic>> _surveys = [];
  List<Map<String, dynamic>> _events = [];
  final _eventTitleCtrl = TextEditingController();
  final _eventDescCtrl = TextEditingController();
  final _eventStartsCtrl = TextEditingController();
  String _eventType = 'one_off';
  String _recurrenceRule = 'weekly';
  String? _editingEventId;
  String? _editingWikiId;
  String? _editingChallengeId;
  String? _editingSurveyId;
  bool _loading = true;
  List<String> _announceMediaUrls = [];
  bool _uploadingMedia = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _announceTitleCtrl.dispose();
    _announceBodyCtrl.dispose();
    _pollQuestionCtrl.dispose();
    _pollOptionsCtrl.dispose();
    _wikiTitleCtrl.dispose();
    _wikiBodyCtrl.dispose();
    _challengeTitleCtrl.dispose();
    _challengeDescCtrl.dispose();
    _surveyTitleCtrl.dispose();
    _surveyQuestionsCtrl.dispose();
    _eventTitleCtrl.dispose();
    _eventDescCtrl.dispose();
    _eventStartsCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      if (widget.fixedCommunityId != null) {
        setState(() {
          _communityId = widget.fixedCommunityId;
          _loading = false;
        });
        await _loadAnalytics(widget.fixedCommunityId!);
        await _loadEngagementLists(widget.fixedCommunityId!);
        return;
      }
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      final creatorId = user?['id'] as String?;
      if (creatorId == null) return;
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/$creatorId/communities');
      final list = (res.data['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      setState(() {
        _communities = list;
        _communityId = list.isNotEmpty ? list.first['id'] as String? : null;
        _loading = false;
      });
      if (_communityId != null) await _loadAnalytics(_communityId!);
      if (_communityId != null) await _loadEngagementLists(_communityId!);
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _loadEngagementLists(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final wikiRes = await client.dio.get('/communities/$communityId/wiki');
      final challengeRes = await client.dio.get('/communities/$communityId/challenges');
      final surveyRes = await client.dio.get('/communities/$communityId/surveys');
      final eventsRes = await client.dio.get(
        '/communities/$communityId/events',
        queryParameters: {'seriesOnly': '1'},
      );
      setState(() {
        _wikiPages = _unwrapList(wikiRes.data['data']);
        _challenges = _unwrapList(challengeRes.data['data']);
        _surveys = _unwrapList(surveyRes.data['data']);
        _events = _unwrapList(eventsRes.data['data']);
      });
    } catch (_) {}
  }

  Future<void> _loadSurveyAnalytics(String surveyId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get(
        '/creators/me/communities/$_communityId/surveys/$surveyId/analytics',
      );
      if (mounted) {
        final data = res.data['data'] as Map<String, dynamic>?;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${data?['responseCount'] ?? 0} responses'),
          ),
        );
      }
    } catch (_) {}
  }

  Future<void> _deleteWiki(String wikiId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/wiki/$wikiId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete wiki page')),
        );
      }
    }
  }

  Future<void> _deleteChallenge(String challengeId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/challenges/$challengeId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete challenge')),
        );
      }
    }
  }

  Future<void> _deleteSurvey(String surveyId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/surveys/$surveyId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete survey')),
        );
      }
    }
  }

  Future<void> _loadAnalytics(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/me/communities/$communityId/analytics');
      setState(() => _analytics = res.data['data'] as Map<String, dynamic>?);
    } catch (_) {}
  }

  Future<void> _pickAnnouncementImage() async {
    if (_communityId == null || _uploadingMedia) return;
    final picked = await FilePicker.pickFiles(type: FileType.image);
    final path = picked?.files.single.path;
    if (path == null) return;
    setState(() => _uploadingMedia = true);
    try {
      const contentType = 'image/jpeg';
      final client = ref.read(apiClientProvider);
      final presignRes = await client.dio.post(
        '/creators/me/communities/$_communityId/posts/media-upload-url',
        queryParameters: {'contentType': contentType},
      );
      final presign = presignRes.data['data'] as Map<String, dynamic>;
      final uploadUrl = presign['uploadUrl'] as String;
      final publicUrl = presign['publicUrl'] as String;
      await client.dio.put(
        uploadUrl,
        data: File(path).openRead(),
        options: Options(headers: {'Content-Type': contentType}),
      );
      setState(() => _announceMediaUrls = [..._announceMediaUrls, publicUrl]);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image upload failed')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingMedia = false);
    }
  }

  Future<void> _postAnnouncement() async {
    if (_communityId == null || _announceBodyCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$_communityId/posts', data: {
        'title': _announceTitleCtrl.text.trim().isEmpty ? null : _announceTitleCtrl.text.trim(),
        'body': _announceBodyCtrl.text.trim(),
        'postType': 'announcement',
        if (_announceMediaUrls.isNotEmpty) 'mediaUrls': _announceMediaUrls,
      });
      _announceTitleCtrl.clear();
      _announceBodyCtrl.clear();
      setState(() => _announceMediaUrls = []);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Announcement posted')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not post announcement')),
        );
      }
    }
  }

  Future<void> _createPoll() async {
    if (_communityId == null || _pollQuestionCtrl.text.trim().isEmpty) return;
    final options = _pollOptionsCtrl.text
        .split('\n')
        .map((o) => o.trim())
        .where((o) => o.isNotEmpty)
        .toList();
    if (options.length < 2) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$_communityId/polls', data: {
        'question': _pollQuestionCtrl.text.trim(),
        'options': options,
      });
      _pollQuestionCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Poll created')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create poll')),
        );
      }
    }
  }

  Future<void> _createWiki() async {
    if (_communityId == null || _wikiTitleCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      if (_editingWikiId != null) {
        await client.dio.patch('/creators/me/communities/$_communityId/wiki/$_editingWikiId', data: {
          'title': _wikiTitleCtrl.text.trim(),
          'body': _wikiBodyCtrl.text.trim(),
        });
      } else {
        await client.dio.post('/creators/me/communities/$_communityId/wiki', data: {
          'title': _wikiTitleCtrl.text.trim(),
          'body': _wikiBodyCtrl.text.trim(),
        });
      }
      _wikiTitleCtrl.clear();
      _wikiBodyCtrl.clear();
      setState(() => _editingWikiId = null);
      await _loadEngagementLists(_communityId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Wiki page added')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save wiki page')),
        );
      }
    }
  }

  Future<void> _createChallenge() async {
    if (_communityId == null || _challengeTitleCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      if (_editingChallengeId != null) {
        await client.dio.patch(
          '/creators/me/communities/$_communityId/challenges/$_editingChallengeId',
          data: {
            'title': _challengeTitleCtrl.text.trim(),
            'description':
                _challengeDescCtrl.text.trim().isEmpty ? null : _challengeDescCtrl.text.trim(),
          },
        );
      } else {
        await client.dio.post('/creators/me/communities/$_communityId/challenges', data: {
          'title': _challengeTitleCtrl.text.trim(),
          'description':
              _challengeDescCtrl.text.trim().isEmpty ? null : _challengeDescCtrl.text.trim(),
        });
      }
      _challengeTitleCtrl.clear();
      _challengeDescCtrl.clear();
      setState(() => _editingChallengeId = null);
      await _loadEngagementLists(_communityId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Challenge launched')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save challenge')),
        );
      }
    }
  }

  Future<void> _createEvent() async {
    if (_communityId == null || _eventTitleCtrl.text.trim().isEmpty || _eventStartsCtrl.text.trim().isEmpty) {
      return;
    }
    try {
      final client = ref.read(apiClientProvider);
      final startsAt = DateTime.parse(_eventStartsCtrl.text.trim()).toUtc().toIso8601String();
      final payload = <String, dynamic>{
        'title': _eventTitleCtrl.text.trim(),
        'description': _eventDescCtrl.text.trim().isEmpty ? null : _eventDescCtrl.text.trim(),
        'startsAt': startsAt,
        'isOnline': true,
        'eventType': _eventType,
        if (_eventType == 'recurring') 'recurrenceRule': _recurrenceRule,
      };
      if (_editingEventId != null) {
        await client.dio.patch(
          '/creators/me/communities/$_communityId/events/$_editingEventId',
          data: payload,
        );
      } else {
        await client.dio.post('/creators/me/communities/$_communityId/events', data: payload);
      }
      _eventTitleCtrl.clear();
      _eventDescCtrl.clear();
      _eventStartsCtrl.clear();
      setState(() {
        _editingEventId = null;
        _eventType = 'one_off';
      });
      await _loadEngagementLists(_communityId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Event saved')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save event')),
        );
      }
    }
  }

  Future<void> _deleteEvent(String eventId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/events/$eventId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete event')),
        );
      }
    }
  }

  Future<void> _createSurvey() async {
    if (_communityId == null || _surveyTitleCtrl.text.trim().isEmpty) return;
    final questions = _surveyQuestionsCtrl.text
        .split('\n')
        .map((q) => q.trim())
        .where((q) => q.isNotEmpty)
        .map((question) => {'question': question, 'type': 'text'})
        .toList();
    if (questions.isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      final payload = {'title': _surveyTitleCtrl.text.trim(), 'questions': questions};
      if (_editingSurveyId != null) {
        await client.dio.patch(
          '/creators/me/communities/$_communityId/surveys/$_editingSurveyId',
          data: payload,
        );
      } else {
        await client.dio.post('/creators/me/communities/$_communityId/surveys', data: payload);
      }
      _surveyTitleCtrl.clear();
      setState(() => _editingSurveyId = null);
      await _loadEngagementLists(_communityId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Survey published')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not publish survey')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      final loading = const Center(child: CircularProgressIndicator());
      if (widget.embedded) return loading;
      return Scaffold(appBar: AppBar(title: const Text('Community engagement')), body: loading);
    }
    if (widget.embedded && _communityId == null) {
      return const Center(child: Text('Create a community in Settings first'));
    }

    final body = ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (!widget.embedded && _communities.length > 1)
                  DropdownButtonFormField<String>(
                    value: _communityId,
                    decoration: const InputDecoration(labelText: 'Community'),
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
                      setState(() => _communityId = id);
                      _loadAnalytics(id);
                      _loadEngagementLists(id);
                    },
                  ),
                if (_analytics != null) ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('7-day analytics', style: TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            'Messages: ${_analytics!['messagesLast7Days'] ?? 0} · '
                            'Members: ${_analytics!['payingMembers'] ?? 0}',
                            style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                const Text('Announcement', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _announceTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Title (optional)'),
                ),
                TextField(
                  controller: _announceBodyCtrl,
                  decoration: const InputDecoration(labelText: 'Body'),
                  maxLines: 3,
                ),
                if (_announceMediaUrls.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    children: _announceMediaUrls
                        .map((url) => Chip(label: Text(url.split('/').last)))
                        .toList(),
                  ),
                TextButton.icon(
                  onPressed: _uploadingMedia ? null : _pickAnnouncementImage,
                  icon: _uploadingMedia
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.image_outlined),
                  label: const Text('Attach image'),
                ),
                ForgeButton(label: 'Post announcement', onPressed: _postAnnouncement),
                const Divider(height: 32),
                const Text('Poll', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _pollQuestionCtrl,
                  decoration: const InputDecoration(labelText: 'Question'),
                ),
                TextField(
                  controller: _pollOptionsCtrl,
                  decoration: const InputDecoration(labelText: 'Options (one per line)'),
                  maxLines: 4,
                ),
                ForgeButton(label: 'Create poll', onPressed: _createPoll),
                const Divider(height: 32),
                const Text('Events', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _eventTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Event title'),
                ),
                TextField(
                  controller: _eventDescCtrl,
                  decoration: const InputDecoration(labelText: 'Description (optional)'),
                  maxLines: 2,
                ),
                TextField(
                  controller: _eventStartsCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Starts at (ISO 8601)',
                    hintText: '2026-07-01T18:00:00Z',
                  ),
                ),
                DropdownButtonFormField<String>(
                  value: _eventType,
                  decoration: const InputDecoration(labelText: 'Event type'),
                  items: const [
                    DropdownMenuItem(value: 'one_off', child: Text('One-off')),
                    DropdownMenuItem(value: 'recurring', child: Text('Recurring')),
                  ],
                  onChanged: (v) => setState(() => _eventType = v ?? 'one_off'),
                ),
                if (_eventType == 'recurring')
                  DropdownButtonFormField<String>(
                    value: _recurrenceRule,
                    decoration: const InputDecoration(labelText: 'Recurrence'),
                    items: const [
                      DropdownMenuItem(value: 'weekly', child: Text('Weekly')),
                      DropdownMenuItem(value: 'biweekly', child: Text('Biweekly')),
                      DropdownMenuItem(value: 'monthly', child: Text('Monthly')),
                    ],
                    onChanged: (v) => setState(() => _recurrenceRule = v ?? 'weekly'),
                  ),
                ForgeButton(
                  label: _editingEventId == null ? 'Create event' : 'Save event',
                  onPressed: _createEvent,
                ),
                ..._events.map(
                  (event) => ListTile(
                    dense: true,
                    title: Text(event['title'] as String? ?? ''),
                    subtitle: Text(event['startsAt'] as String? ?? ''),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit, size: 18),
                          onPressed: () {
                            _eventTitleCtrl.text = event['title'] as String? ?? '';
                            _eventDescCtrl.text = event['description'] as String? ?? '';
                            _eventStartsCtrl.text = event['startsAt'] as String? ?? '';
                            setState(() {
                              _editingEventId = event['id'] as String?;
                              _eventType = event['eventType'] as String? ?? 'one_off';
                              _recurrenceRule = event['recurrenceRule'] as String? ?? 'weekly';
                            });
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18),
                          onPressed: () => _deleteEvent(event['id'] as String),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 32),
                const Text('Wiki page', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _wikiTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: _wikiBodyCtrl,
                  decoration: const InputDecoration(labelText: 'Content'),
                  maxLines: 3,
                ),
                ForgeButton(
                  label: _editingWikiId == null ? 'Add wiki page' : 'Save wiki page',
                  onPressed: _createWiki,
                ),
                ..._wikiPages.map(
                  (page) => ListTile(
                    dense: true,
                    title: Text(page['title'] as String? ?? ''),
                    subtitle: Text(page['body'] as String? ?? ''),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit, size: 18),
                          onPressed: () {
                            _wikiTitleCtrl.text = page['title'] as String? ?? '';
                            _wikiBodyCtrl.text = page['body'] as String? ?? '';
                            setState(() => _editingWikiId = page['id'] as String?);
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18),
                          onPressed: () => _deleteWiki(page['id'] as String),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 32),
                const Text('Challenge', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _challengeTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: _challengeDescCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 2,
                ),
                ForgeButton(
                  label: _editingChallengeId == null ? 'Launch challenge' : 'Save challenge',
                  onPressed: _createChallenge,
                ),
                ..._challenges.map(
                  (ch) => ListTile(
                    dense: true,
                    title: Text(ch['title'] as String? ?? ''),
                    subtitle: Text(ch['description'] as String? ?? ''),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.edit, size: 18),
                          onPressed: () {
                            _challengeTitleCtrl.text = ch['title'] as String? ?? '';
                            _challengeDescCtrl.text = ch['description'] as String? ?? '';
                            setState(() => _editingChallengeId = ch['id'] as String?);
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18),
                          onPressed: () => _deleteChallenge(ch['id'] as String),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 32),
                const Text('Survey', style: TextStyle(fontWeight: FontWeight.w600)),
                TextField(
                  controller: _surveyTitleCtrl,
                  decoration: const InputDecoration(labelText: 'Title'),
                ),
                TextField(
                  controller: _surveyQuestionsCtrl,
                  decoration: const InputDecoration(labelText: 'Questions (one per line)'),
                  maxLines: 3,
                ),
                ForgeButton(
                  label: _editingSurveyId == null ? 'Publish survey' : 'Save survey',
                  onPressed: _createSurvey,
                ),
                ..._surveys.map(
                  (survey) => ListTile(
                    dense: true,
                    title: Text(survey['title'] as String? ?? ''),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.bar_chart, size: 18),
                          onPressed: () => _loadSurveyAnalytics(survey['id'] as String),
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit, size: 18),
                          onPressed: () {
                            _surveyTitleCtrl.text = survey['title'] as String? ?? '';
                            setState(() => _editingSurveyId = survey['id'] as String?);
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18),
                          onPressed: () => _deleteSurvey(survey['id'] as String),
                        ),
                      ],
                    ),
                  ),
                ),
                if (!widget.embedded)
                  TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            );

    if (widget.embedded) return body;
    return Scaffold(appBar: AppBar(title: const Text('Community engagement')), body: body);
  }
}
