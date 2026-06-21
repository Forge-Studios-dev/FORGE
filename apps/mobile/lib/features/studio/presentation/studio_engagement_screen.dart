import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';

class StudioEngagementScreen extends ConsumerStatefulWidget {
  const StudioEngagementScreen({super.key});

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
  String? _editingWikiId;
  String? _editingChallengeId;
  String? _editingSurveyId;
  bool _loading = true;

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
    super.dispose();
  }

  Future<void> _load() async {
    try {
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
      setState(() {
        _wikiPages = (wikiRes.data['data']?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _challenges =
            (challengeRes.data['data']?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        _surveys = (surveyRes.data['data']?['data'] as List?)?.cast<Map<String, dynamic>>() ?? [];
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
    } catch (_) {}
  }

  Future<void> _deleteChallenge(String challengeId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/challenges/$challengeId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {}
  }

  Future<void> _deleteSurvey(String surveyId) async {
    if (_communityId == null) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.delete('/creators/me/communities/$_communityId/surveys/$surveyId');
      await _loadEngagementLists(_communityId!);
    } catch (_) {}
  }

  Future<void> _loadAnalytics(String communityId) async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.dio.get('/creators/me/communities/$communityId/analytics');
      setState(() => _analytics = res.data['data'] as Map<String, dynamic>?);
    } catch (_) {}
  }

  Future<void> _postAnnouncement() async {
    if (_communityId == null || _announceBodyCtrl.text.trim().isEmpty) return;
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/creators/me/communities/$_communityId/posts', data: {
        'title': _announceTitleCtrl.text.trim().isEmpty ? null : _announceTitleCtrl.text.trim(),
        'body': _announceBodyCtrl.text.trim(),
        'postType': 'announcement',
      });
      _announceTitleCtrl.clear();
      _announceBodyCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Announcement posted')),
        );
      }
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}
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
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Community engagement')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (_communities.length > 1)
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
                            style: const TextStyle(fontSize: 13, color: ForgeTokens.onSurfaceVariant),
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
                TextButton(onPressed: () => context.pop(), child: const Text('← Back to Studio')),
              ],
            ),
    );
  }
}
