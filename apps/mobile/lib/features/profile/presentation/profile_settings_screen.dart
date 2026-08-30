import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/analytics/forge_analytics.dart';
import '../../../core/cache/local_cache.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/theme_mode_provider.dart';
import '../../../core/utils/json_export_util.dart';
import '../../../core/utils/username_cooldown.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';
import '../../watch/data/watch_repository.dart';
import '../data/profile_repository.dart';
import '../../../core/theme/forge_tokens.dart';

const _autoplayPrefKey = 'forge.watch.autoplay';
const _loopPrefKey = 'forge.watch.loop';

class ProfileSettingsScreen extends ConsumerStatefulWidget {
  const ProfileSettingsScreen({super.key});

  @override
  ConsumerState<ProfileSettingsScreen> createState() => _ProfileSettingsScreenState();
}

class _ProfileSettingsScreenState extends ConsumerState<ProfileSettingsScreen> {
  static const int _maxAvatarBytes = 5 * 1024 * 1024;
  static const int _maxBannerBytes = 8 * 1024 * 1024;
  final _displayName = TextEditingController();
  final _username = TextEditingController();
  final _bio = TextEditingController();
  final _websiteUrl = TextEditingController();
  final _scrollController = ScrollController();
  final _privacyKey = GlobalKey();
  final _analyticsKey = GlobalKey();
  final List<_ChannelLinkDraft> _channelLinks = [];
  bool _loading = true;
  bool _saving = false;
  bool _mediaUploading = false;
  bool _watchHistoryPaused = false;
  bool _privacySaving = false;
  bool _didScrollToSection = false;
  bool _autoplay = true;
  bool _loopVideo = false;
  bool _analyticsOptIn = true;
  String? _userId;
  String? _bannerUrl;
  String? _avatarUrl;
  String? _usernameChangedAt;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final autoplayPref = LocalCache.read(_autoplayPrefKey);
      if (autoplayPref == '0') _autoplay = false;
      if (autoplayPref == '1') _autoplay = true;
      _loopVideo = LocalCache.read(_loopPrefKey) == '1';
      _analyticsOptIn = analyticsOptInGranted();

      final repo = ref.read(profileRepositoryProvider);
      final data = await repo.getMe();
      _userId = data['id'] as String?;
      _username.text = data['username'] as String? ?? '';
      _usernameChangedAt = data['usernameChangedAt'] as String?;
      _displayName.text = data['displayName'] as String? ?? '';
      _bio.text = data['bio'] as String? ?? '';
      _websiteUrl.text = data['websiteUrl'] as String? ?? '';
      _bannerUrl = data['bannerUrl'] as String?;
      _avatarUrl = data['avatarUrl'] as String?;
      final links = data['channelLinks'];
      _channelLinks
        ..clear()
        ..addAll(
          (links is List ? links : const [])
              .whereType<Map>()
              .map(
                (e) => _ChannelLinkDraft(
                  title: TextEditingController(text: e['title'] as String? ?? ''),
                  url: TextEditingController(text: e['url'] as String? ?? ''),
                ),
              ),
        );
      try {
        final privacyData = await repo.getPrivacy();
        _watchHistoryPaused = privacyData?['watchHistoryPaused'] as bool? ?? false;
      } catch (_) {
        /* privacy endpoint optional on older builds */
      }
    } catch (_) {
      if (mounted) context.go('/login');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        WidgetsBinding.instance.addPostFrameCallback((_) => _maybeScrollToSection());
      }
    }
  }

  void _maybeScrollToSection() {
    if (_didScrollToSection || !mounted) return;
    final section = GoRouterState.of(context).uri.queryParameters['section'];
    if (section != 'privacy' && section != 'analytics' && section != 'cookies') return;
    final key = section == 'privacy' ? _privacyKey : _analyticsKey;
    final ctx = key.currentContext;
    if (ctx == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeScrollToSection());
      return;
    }
    _didScrollToSection = true;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOut,
      alignment: 0.15,
    );
  }

  Future<void> _setWatchHistoryPaused(bool next) async {
    setState(() {
      _watchHistoryPaused = next;
      _privacySaving = true;
    });
    try {
      await ref.read(profileRepositoryProvider).updatePrivacy(watchHistoryPaused: next);
    } catch (_) {
      if (mounted) {
        setState(() => _watchHistoryPaused = !next);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update privacy setting')),
        );
      }
    } finally {
      if (mounted) setState(() => _privacySaving = false);
    }
  }

  Future<void> _uploadChannelImage({required bool banner}) async {
    final userId = _userId;
    if (userId == null || _mediaUploading) return;
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp'],
      withData: true,
    );
    final file = result?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null || bytes.isEmpty) return;
    final maxBytes = banner ? _maxBannerBytes : _maxAvatarBytes;
    if (bytes.length > maxBytes) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              banner ? 'Banner must be 8MB or smaller' : 'Photo must be 5MB or smaller',
            ),
          ),
        );
      }
      return;
    }

    final contentType = switch (file.extension?.toLowerCase()) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };

    setState(() => _mediaUploading = true);
    try {
      final publicUrl = await ref.read(profileRepositoryProvider).uploadChannelImage(
            userId: userId,
            banner: banner,
            contentType: contentType,
            bytes: bytes,
          );
      if (!mounted) return;
      setState(() {
        if (banner) {
          _bannerUrl = publicUrl;
        } else {
          _avatarUrl = publicUrl;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(banner ? 'Banner updated' : 'Photo updated')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not upload image')),
        );
      }
    } finally {
      if (mounted) setState(() => _mediaUploading = false);
    }
  }

  Future<void> _save() async {
    if (_userId == null) return;
    setState(() => _saving = true);
    try {
      final cleanedLinks = _channelLinks
          .map(
            (l) => {
              'title': l.title.text.trim(),
              'url': l.url.text.trim(),
            },
          )
          .where((l) => (l['url'] as String).isNotEmpty)
          .toList();
      final nextUsername = _username.text.trim().replaceFirst(RegExp(r'^@'), '');
      final usernameLocked = isUsernameRenameLocked(_usernameChangedAt);
      final updated = await ref.read(profileRepositoryProvider).updateProfile(
            _userId!,
            username: usernameLocked ? null : nextUsername,
            displayName: _displayName.text.trim(),
            bio: _bio.text.trim().isEmpty ? null : _bio.text.trim(),
            websiteUrl: _websiteUrl.text.trim().isEmpty ? null : _websiteUrl.text.trim(),
            channelLinks: cleanedLinks,
          );
      _username.text = updated['username'] as String? ?? nextUsername;
      _usernameChangedAt = updated['usernameChangedAt'] as String?;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings saved')),
        );
      }
    } catch (e) {
      String msg = 'Could not save settings';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map && data['message'] != null) {
          final m = data['message'];
          msg = m is List ? m.first.toString() : m.toString();
        }
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _username.dispose();
    _displayName.dispose();
    _bio.dispose();
    _websiteUrl.dispose();
    for (final link in _channelLinks) {
      link.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(
          GoRouterState.of(context).uri.path.startsWith('/studio/branding')
              ? 'Customize channel'
              : 'Settings',
        ),
      ),
      body: ListView(
        controller: _scrollController,
        padding: const EdgeInsets.all(20),
        children: [
          if (_bannerUrl != null && _bannerUrl!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 6,
                child: Image.network(_bannerUrl!, fit: BoxFit.cover),
              ),
            )
          else
            Container(
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: ForgeTokens.of(context).surfaceContainerHigh,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text('No banner yet', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant)),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton(
                onPressed: _mediaUploading ? null : () => _uploadChannelImage(banner: true),
                child: Text(_mediaUploading ? 'Uploading…' : 'Change banner'),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _mediaUploading ? null : () => _uploadChannelImage(banner: false),
                child: Text(_avatarUrl == null ? 'Add photo' : 'Change photo'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Builder(
            builder: (context) {
              final unlockAt = usernameRenameUnlockAt(_usernameChangedAt);
              final locked = unlockAt != null;
              return TextField(
                controller: _username,
                enabled: !locked,
                readOnly: locked,
                decoration: InputDecoration(
                  labelText: 'Username',
                  prefixText: '@',
                  helperText: locked
                      ? 'Handle locked until ${formatUsernameUnlockDate(unlockAt)} (once every 14 days)'
                      : 'Letters, numbers, underscores · 3–30 chars · change once every 14 days',
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _displayName,
            decoration: const InputDecoration(labelText: 'Display name'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _bio,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Bio'),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _websiteUrl,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              labelText: 'Website',
              hintText: 'https://…',
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              const Expanded(
                child: Text('Channel links', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              TextButton.icon(
                onPressed: _channelLinks.length >= 5
                    ? null
                    : () => setState(
                          () => _channelLinks.add(
                            _ChannelLinkDraft(
                              title: TextEditingController(),
                              url: TextEditingController(),
                            ),
                          ),
                        ),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Add'),
              ),
            ],
          ),
          ...List.generate(_channelLinks.length, (i) {
            final link = _channelLinks[i];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        TextField(
                          controller: link.title,
                          decoration: const InputDecoration(labelText: 'Title'),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: link.url,
                          keyboardType: TextInputType.url,
                          decoration: const InputDecoration(labelText: 'URL'),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Remove',
                    onPressed: () => setState(() {
                      final removed = _channelLinks.removeAt(i);
                      removed.dispose();
                    }),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 24),
          ForgeButton(
            label: _saving ? 'Saving…' : 'Save changes',
            onPressed: _saving ? null : _save,
          ),
          const SizedBox(height: 24),
          SwitchListTile(
            key: _privacyKey,
            contentPadding: EdgeInsets.zero,
            title: const Text('Pause watch history'),
            subtitle: const Text("New watches won't be saved to History."),
            value: _watchHistoryPaused,
            onChanged: _privacySaving ? null : _setWatchHistoryPaused,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Autoplay next video'),
            subtitle: const Text('Start the next video when one ends.'),
            value: _autoplay,
            onChanged: (v) async {
              setState(() => _autoplay = v);
              await LocalCache.write(_autoplayPrefKey, v ? '1' : '0');
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Loop video'),
            subtitle: const Text('Replay the current video instead of advancing.'),
            value: _loopVideo,
            onChanged: (v) async {
              setState(() => _loopVideo = v);
              await LocalCache.write(_loopPrefKey, v ? '1' : '0');
            },
          ),
          SwitchListTile(
            key: _analyticsKey,
            contentPadding: EdgeInsets.zero,
            title: const Text('Product analytics'),
            subtitle: const Text(
              'Help improve FORGE with anonymous usage events. Off stays local to this device.',
            ),
            value: _analyticsOptIn,
            onChanged: (v) async {
              setState(() => _analyticsOptIn = v);
              await setAnalyticsOptIn(v);
            },
          ),
          const SizedBox(height: 8),
          const _ThemeModeTile(),
          const SizedBox(height: 16),
          const _NotificationPreferencesSection(),
          const SizedBox(height: 16),
          const _MutedChannelsSection(),
          const SizedBox(height: 16),
          const _BlockedUsersSection(),
          const SizedBox(height: 16),
          const _InterestsSection(),
          const SizedBox(height: 8),
          ListTile(
            title: const Text('My memberships'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/memberships'),
          ),
          ListTile(
            title: const Text('Channel strikes'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push('/settings/strikes'),
          ),
          const SizedBox(height: 24),
          const Text('Security', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _ChangePasswordSection(),
          const SizedBox(height: 24),
          const Text('Two-factor authentication', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _MfaSection(),
          const SizedBox(height: 24),
          const Text('Active sessions', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _ActiveSessionsSection(),
          const SizedBox(height: 32),
          OutlinedButton(
            onPressed: () async {
              await ref.read(authRepositoryProvider).logout();
              if (context.mounted) context.go('/login');
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: ForgeTokens.of(context).error,
              side: BorderSide(color: ForgeTokens.of(context).error),
            ),
            child: const Text('Sign out'),
          ),
          const SizedBox(height: 24),
          const Text('Download your data', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _DataExportSection(),
          const SizedBox(height: 24),
          const Text('Delete account', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const _DeleteAccountSection(),
        ],
      ),
    );
  }
}

class _ThemeModeTile extends ConsumerWidget {
  const _ThemeModeTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final label = switch (mode) {
      ThemeMode.light => 'Light',
      ThemeMode.dark => 'Dark',
      ThemeMode.system => 'System',
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: const Text('Appearance'),
      subtitle: Text(label),
      trailing: const Icon(Icons.brightness_6_outlined),
      onTap: () async {
        final next = switch (mode) {
          ThemeMode.system => ThemeMode.light,
          ThemeMode.light => ThemeMode.dark,
          ThemeMode.dark => ThemeMode.system,
        };
        await ref.read(themeModeProvider.notifier).setMode(next);
      },
    );
  }
}

class _ChangePasswordSection extends ConsumerStatefulWidget {
  const _ChangePasswordSection();

  @override
  ConsumerState<_ChangePasswordSection> createState() => _ChangePasswordSectionState();
}

class _ChangePasswordSectionState extends ConsumerState<_ChangePasswordSection> {
  static final _passwordPattern = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)');
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _saving = false;
  bool _emailPending = false;
  String? _error;
  String? _message;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _message = null;
    });
    if (_next.text != _confirm.text) {
      setState(() => _error = 'New passwords do not match.');
      return;
    }
    if (_next.text.length < 8 || !_passwordPattern.hasMatch(_next.text)) {
      setState(() => _error = 'Include uppercase, lowercase, and a number (8+ chars).');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(authRepositoryProvider).changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      _current.clear();
      _next.clear();
      _confirm.clear();
      if (mounted) {
        setState(() => _message = 'Password updated. Other devices were signed out.');
      }
    } on DioException catch (e) {
      final data = e.response?.data;
      String? msg;
      if (data is Map) {
        final m = data['message'];
        if (m is String) msg = m;
        if (m is List) msg = m.cast<String>().join(', ');
      }
      if (mounted) setState(() => _error = msg ?? 'Could not change password.');
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not change password.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _emailReset() async {
    setState(() {
      _emailPending = true;
      _error = null;
      _message = null;
    });
    try {
      final me = await ref.read(profileRepositoryProvider).getMe();
      final email = me['email'] as String?;
      if (email == null || email.isEmpty) {
        throw StateError('missing email');
      }
      await ref.read(authRepositoryProvider).forgotPassword(email: email);
      if (mounted) {
        setState(() => _message = 'If that email is registered, a reset link is on its way.');
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not start password reset.');
    } finally {
      if (mounted) setState(() => _emailPending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Change your password. Other sessions will be signed out.',
          style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _current,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Current password'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _next,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'New password'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _confirm,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Confirm new password'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: ForgeTokens.of(context).error, fontSize: 13)),
        ],
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(_message!, style: TextStyle(color: ForgeTokens.of(context).secondary, fontSize: 13)),
        ],
        const SizedBox(height: 12),
        ForgeButton(
          label: _saving ? 'Updating…' : 'Update password',
          onPressed: _saving || _emailPending ? null : _submit,
        ),
        TextButton(
          onPressed: _saving || _emailPending ? null : _emailReset,
          child: Text(_emailPending ? 'Sending…' : 'Email password reset link'),
        ),
      ],
    );
  }
}

enum _MfaStep { loading, off, enrolling, backupCodes, on, disabling }

class _MfaSection extends ConsumerStatefulWidget {
  const _MfaSection();

  @override
  ConsumerState<_MfaSection> createState() => _MfaSectionState();
}

class _MfaSectionState extends ConsumerState<_MfaSection> {
  _MfaStep _step = _MfaStep.loading;
  String _secret = '';
  String _otpauthUri = '';
  final _codeCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  List<String> _backupCodes = [];
  bool _pending = false;
  String? _error;
  String? _message;

  @override
  void initState() {
    super.initState();
    ref.read(authRepositoryProvider).getMfaStatus().then((enabled) {
      if (mounted) setState(() => _step = enabled ? _MfaStep.on : _MfaStep.off);
    }).catchError((_) {
      if (mounted) setState(() => _step = _MfaStep.off);
    });
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _startEnrollment() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final data = await ref.read(authRepositoryProvider).beginMfaEnrollment();
      setState(() {
        _secret = data['secret'] as String;
        _otpauthUri = data['otpauthUri'] as String;
        _step = _MfaStep.enrolling;
      });
    } catch (_) {
      setState(() => _error = 'Could not start enrollment. Try again.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Future<void> _confirmEnrollment() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final codes = await ref.read(authRepositoryProvider).confirmMfaEnrollment(
            code: _codeCtrl.text.trim(),
          );
      _codeCtrl.clear();
      setState(() {
        _backupCodes = codes;
        _step = _MfaStep.backupCodes;
      });
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data['message'] : null;
      setState(() => _error = msg is String ? msg : 'Invalid code. Try again.');
    } catch (_) {
      setState(() => _error = 'Invalid code. Try again.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Future<void> _disable() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).disableMfa(currentPassword: _passwordCtrl.text);
      _passwordCtrl.clear();
      setState(() {
        _step = _MfaStep.off;
        _message = 'Two-factor authentication is now off.';
      });
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data['message'] : null;
      setState(() => _error = msg is String ? msg : 'Could not disable — check your password.');
    } catch (_) {
      setState(() => _error = 'Could not disable — check your password.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    if (_step == _MfaStep.loading) return const SizedBox.shrink();

    Widget body;
    switch (_step) {
      case _MfaStep.off:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Add an extra step at sign-in using an authenticator app.',
              style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            ForgeButton(
              label: _pending ? 'Starting…' : 'Enable two-factor authentication',
              onPressed: _pending ? null : _startEnrollment,
            ),
          ],
        );
        break;
      case _MfaStep.enrolling:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'In your authenticator app, add a new account using this setup key, then enter the code it shows.',
              style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            SelectableText(_secret, style: const TextStyle(fontFamily: 'monospace')),
            const SizedBox(height: 4),
            Text('otpauth URI: $_otpauthUri',
                style: TextStyle(fontSize: 11, color: t.onSurfaceVariant)),
            const SizedBox(height: 12),
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '6-digit code'),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: ForgeButton(
                  label: _pending ? 'Confirming…' : 'Confirm',
                  onPressed: _pending ? null : _confirmEnrollment,
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _pending ? null : () => setState(() => _step = _MfaStep.off),
                child: const Text('Cancel'),
              ),
            ]),
          ],
        );
        break;
      case _MfaStep.backupCodes:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Two-factor authentication is on. Save these one-time backup codes — each works once if you lose access to your authenticator app. They will not be shown again.',
              style: TextStyle(fontSize: 13, color: t.onSurface),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: _backupCodes
                  .map((c) => Text(c, style: const TextStyle(fontFamily: 'monospace')))
                  .toList(),
            ),
            const SizedBox(height: 12),
            ForgeButton(label: 'Done', onPressed: () => setState(() => _step = _MfaStep.on)),
          ],
        );
        break;
      case _MfaStep.on:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Two-factor authentication is on.', style: TextStyle(color: t.secondary, fontSize: 13)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => setState(() => _step = _MfaStep.disabling),
              child: const Text('Disable'),
            ),
          ],
        );
        break;
      case _MfaStep.disabling:
        body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _passwordCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current password'),
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: ForgeButton(
                  label: _pending ? 'Disabling…' : 'Confirm disable',
                  onPressed: _pending ? null : _disable,
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _pending ? null : () => setState(() => _step = _MfaStep.on),
                child: const Text('Cancel'),
              ),
            ]),
          ],
        );
        break;
      case _MfaStep.loading:
        body = const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        body,
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: t.error, fontSize: 13)),
        ],
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(_message!, style: TextStyle(color: t.secondary, fontSize: 13)),
        ],
      ],
    );
  }
}

class _DataExportSection extends ConsumerStatefulWidget {
  const _DataExportSection();

  @override
  ConsumerState<_DataExportSection> createState() => _DataExportSectionState();
}

class _DataExportSectionState extends ConsumerState<_DataExportSection> {
  bool _pending = false;
  String? _error;
  String? _message;

  Future<void> _export() async {
    setState(() {
      _pending = true;
      _error = null;
      _message = null;
    });
    try {
      final stamp = DateTime.now().toIso8601String().split('T').first;
      await JsonExportUtil.downloadAndShare(
        dio: ref.read(apiClientProvider).dio,
        apiPath: '/users/me/export',
        filename: 'forge-data-export-$stamp.json',
      );
      if (mounted) setState(() => _message = 'Export ready — use the share sheet to save it.');
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not export your data. Try again.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Get a JSON copy of your profile, videos, playlists, watch history, comments, community posts, and account strikes.',
          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: _pending ? null : _export,
          child: Text(_pending ? 'Preparing…' : 'Download JSON'),
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(_message!, style: TextStyle(color: t.secondary, fontSize: 13)),
        ],
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: t.error, fontSize: 13)),
        ],
      ],
    );
  }
}

class _DeleteAccountSection extends ConsumerStatefulWidget {
  const _DeleteAccountSection();

  @override
  ConsumerState<_DeleteAccountSection> createState() => _DeleteAccountSectionState();
}

enum _DeleteMode { closed, password, emailSent }

class _DeleteAccountSectionState extends ConsumerState<_DeleteAccountSection> {
  _DeleteMode _mode = _DeleteMode.closed;
  final _passwordCtrl = TextEditingController();
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _deleteWithPassword() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).deleteAccount(currentPassword: _passwordCtrl.text);
      await ref.read(authRepositoryProvider).logout();
      if (mounted) context.go('/login');
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data['message'] : null;
      setState(() => _error = msg is String ? msg : 'Could not delete account — check your password.');
    } catch (_) {
      setState(() => _error = 'Could not delete account — check your password.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Future<void> _requestEmailLink() async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).requestAccountDeletion();
      setState(() => _mode = _DeleteMode.emailSent);
    } catch (_) {
      setState(() => _error = 'Could not send confirmation email. Try again.');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Permanently deletes your account, hides your videos, and ends any active streams. This cannot be undone.',
          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
        ),
        const SizedBox(height: 12),
        if (_mode == _DeleteMode.closed) ...[
          OutlinedButton(
            onPressed: () => setState(() => _mode = _DeleteMode.password),
            style: OutlinedButton.styleFrom(foregroundColor: t.error, side: BorderSide(color: t.error)),
            child: const Text('Delete with password'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _pending ? null : _requestEmailLink,
            child: const Text('Signed in with Google? Email me a confirmation link'),
          ),
        ],
        if (_mode == _DeleteMode.password) ...[
          TextField(
            controller: _passwordCtrl,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Current password'),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _pending ? null : _deleteWithPassword,
                style: OutlinedButton.styleFrom(
                  foregroundColor: t.error,
                  side: BorderSide(color: t.error),
                ),
                child: Text(_pending ? 'Deleting…' : 'Permanently delete my account'),
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: _pending ? null : () => setState(() => _mode = _DeleteMode.closed),
              child: const Text('Cancel'),
            ),
          ]),
        ],
        if (_mode == _DeleteMode.emailSent)
          Text(
            'If that address is on your account, a confirmation link is on its way — it expires in 15 minutes.',
            style: TextStyle(color: t.secondary, fontSize: 13),
          ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: TextStyle(color: t.error, fontSize: 13)),
        ],
      ],
    );
  }
}

class _ActiveSessionsSection extends ConsumerStatefulWidget {
  const _ActiveSessionsSection();

  @override
  ConsumerState<_ActiveSessionsSection> createState() => _ActiveSessionsSectionState();
}

class _ActiveSessionsSectionState extends ConsumerState<_ActiveSessionsSection> {
  List<Map<String, dynamic>> _sessions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(profileRepositoryProvider).listSessions();
      setState(() {
        _sessions = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _revoke(String sessionId) async {
    await ref.read(profileRepositoryProvider).revokeSession(sessionId);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LinearProgressIndicator();
    if (_sessions.isEmpty) {
      return Text('No other active sessions', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant));
    }
    return Column(
      children: _sessions.map((s) {
        return ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(s['deviceLabel'] as String? ?? 'Device'),
          subtitle: Text(s['userAgent'] as String? ?? ''),
          trailing: TextButton(
            onPressed: () => _revoke(s['id'] as String),
            child: const Text('Revoke'),
          ),
        );
      }).toList(),
    );
  }
}

class _ChannelLinkDraft {
  final TextEditingController title;
  final TextEditingController url;

  _ChannelLinkDraft({required this.title, required this.url});

  void dispose() {
    title.dispose();
    url.dispose();
  }
}

const Map<String, String> _notificationCategoryLabels = {
  'social': 'Social',
  'live': 'Live',
  'content': 'Content',
  'community': 'Community',
  'billing': 'Billing',
  'creator': 'Creator status',
  'reward': 'Rewards',
};

/// Per-category notification toggles + email digest opt-in — mirrors the
/// web `NotificationPreferencesSettings` component against the same
/// `/users/me/notification-preferences` endpoint.
class _NotificationPreferencesSection extends ConsumerStatefulWidget {
  const _NotificationPreferencesSection();

  @override
  ConsumerState<_NotificationPreferencesSection> createState() =>
      _NotificationPreferencesSectionState();
}

class _NotificationPreferencesSectionState extends ConsumerState<_NotificationPreferencesSection> {
  List<String> _mutedCategories = [];
  bool _emailDigest = false;
  bool _loading = true;
  bool _saving = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await ref.read(watchRepositoryProvider).getNotificationPreferences();
      if (!mounted) return;
      setState(() {
        _mutedCategories = (prefs['mutedCategories'] as List? ?? [])
            .whereType<String>()
            .toList();
        _emailDigest = prefs['emailDigest'] as bool? ?? false;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _save({List<String>? mutedCategories, bool? emailDigest}) async {
    final previousMuted = _mutedCategories;
    final previousDigest = _emailDigest;
    final nextMuted = mutedCategories ?? _mutedCategories;
    final nextDigest = emailDigest ?? _emailDigest;
    setState(() {
      _mutedCategories = nextMuted;
      _emailDigest = nextDigest;
      _saving = true;
    });
    try {
      await ref.read(watchRepositoryProvider).setNotificationPreferences(
            mutedCategories: nextMuted,
            emailDigest: nextDigest,
          );
    } catch (_) {
      if (mounted) {
        setState(() {
          _mutedCategories = previousMuted;
          _emailDigest = previousDigest;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update notification preferences')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _toggleCategory(String category, bool enabled) {
    final next = enabled
        ? _mutedCategories.where((c) => c != category).toList()
        : [..._mutedCategories, if (!_mutedCategories.contains(category)) category];
    _save(mutedCategories: next);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Notify me about', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator()
        else if (_error)
          TextButton(onPressed: _load, child: const Text('Retry notification preferences'))
        else ...[
          ..._notificationCategoryLabels.entries.map((entry) {
            final enabled = !_mutedCategories.contains(entry.key);
            return CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              dense: true,
              title: Text(entry.value),
              value: enabled,
              onChanged: _saving ? null : (v) => _toggleCategory(entry.key, v ?? true),
            );
          }),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            dense: true,
            title: const Text('Email digest'),
            subtitle: const Text('Occasional email summary of activity on your account.'),
            value: _emailDigest,
            onChanged: _saving ? null : (v) => _save(emailDigest: v ?? false),
          ),
        ],
      ],
    );
  }
}

class _MutedChannelsSection extends ConsumerStatefulWidget {
  const _MutedChannelsSection();

  @override
  ConsumerState<_MutedChannelsSection> createState() => _MutedChannelsSectionState();
}

class _MutedChannelsSectionState extends ConsumerState<_MutedChannelsSection> {
  List<Map<String, dynamic>> _channels = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(watchRepositoryProvider).listMutedChannels();
      if (!mounted) return;
      setState(() {
        _channels = list;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _unmute(String id) async {
    try {
      await ref.read(watchRepositoryProvider).unmuteChannel(id);
      if (!mounted) return;
      setState(() => _channels = _channels.where((c) => c['id'] != id).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unmute channel')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Recommended content', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(
          'Channels hidden with “Don’t recommend channel”. Unmute anytime.',
          style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator()
        else if (_error)
          TextButton(onPressed: _load, child: const Text('Retry muted channels'))
        else if (_channels.isEmpty)
          Text('No muted channels.', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant))
        else
          ..._channels.map((ch) {
            final id = ch['id'] as String? ?? '';
            final name = ch['displayName'] as String? ?? 'Channel';
            final username = ch['username'] as String? ?? '';
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(name),
              subtitle: username.isNotEmpty ? Text('@$username') : null,
              trailing: TextButton(
                onPressed: id.isEmpty ? null : () => _unmute(id),
                child: const Text('Unmute'),
              ),
            );
          }),
      ],
    );
  }
}

class _BlockedUsersSection extends ConsumerStatefulWidget {
  const _BlockedUsersSection();

  @override
  ConsumerState<_BlockedUsersSection> createState() => _BlockedUsersSectionState();
}

class _BlockedUsersSectionState extends ConsumerState<_BlockedUsersSection> {
  List<Map<String, dynamic>> _users = [];
  bool _loading = true;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(watchRepositoryProvider).listBlockedUsers();
      if (!mounted) return;
      setState(() {
        _users = list;
        _loading = false;
        _error = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  Future<void> _unblock(String id) async {
    try {
      await ref.read(watchRepositoryProvider).unblockUser(id);
      if (!mounted) return;
      setState(() => _users = _users.where((u) => u['id'] != id).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not unblock user')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Blocked users', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(
          'Blocked accounts can’t message you. Their comments stay hidden.',
          style: TextStyle(fontSize: 13, color: ForgeTokens.of(context).onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator()
        else if (_error)
          TextButton(onPressed: _load, child: const Text('Retry blocked users'))
        else if (_users.isEmpty)
          Text('No blocked users.', style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant))
        else
          ..._users.map((u) {
            final id = u['id'] as String? ?? '';
            final name = u['displayName'] as String? ?? 'User';
            final username = u['username'] as String? ?? '';
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(name),
              subtitle: username.isNotEmpty ? Text('@$username') : null,
              trailing: TextButton(
                onPressed: id.isEmpty ? null : () => _unblock(id),
                child: const Text('Unblock'),
              ),
            );
          }),
      ],
    );
  }
}

class _InterestsSection extends ConsumerStatefulWidget {
  const _InterestsSection();

  @override
  ConsumerState<_InterestsSection> createState() => _InterestsSectionState();
}

class _InterestsSectionState extends ConsumerState<_InterestsSection> {
  static const _maxInterests = 5;
  List<Map<String, dynamic>> _categories = [];
  final Set<String> _selected = {};
  Set<String> _saved = {};
  bool _loading = true;
  bool _saving = false;
  bool _error = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final repo = ref.read(profileRepositoryProvider);
      final results = await Future.wait([
        repo.listCategories(),
        repo.getInterestCategoryIds(),
      ]);
      final cats = results[0] as List<Map<String, dynamic>>;
      final ids = results[1] as List<String>;
      if (!mounted) return;
      setState(() {
        _categories = cats;
        _selected
          ..clear()
          ..addAll(ids);
        _saved = Set<String>.from(ids);
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = true;
        });
      }
    }
  }

  void _toggle(String id) {
    setState(() {
      if (_selected.contains(id)) {
        _selected.remove(id);
      } else if (_selected.length < _maxInterests) {
        _selected.add(id);
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(profileRepositoryProvider).setInterests(_selected.toList());
      if (!mounted) return;
      setState(() => _saved = Set<String>.from(_selected));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Interests saved')),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save interests')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  bool get _dirty =>
      _selected.length != _saved.length || _selected.any((id) => !_saved.contains(id));

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Interests', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(
          'Pick up to $_maxInterests topics for your For You feed.',
          style: TextStyle(fontSize: 13, color: t.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        if (_loading)
          const LinearProgressIndicator()
        else if (_error)
          TextButton(onPressed: _load, child: const Text('Retry interests'))
        else ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _categories.map((c) {
              final id = c['id'] as String? ?? '';
              final name = c['name'] as String? ?? 'Category';
              if (id.isEmpty) return const SizedBox.shrink();
              final on = _selected.contains(id);
              return FilterChip(
                label: Text(name),
                selected: on,
                onSelected: (_) => _toggle(id),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Text(
                '${_selected.length}/$_maxInterests selected',
                style: TextStyle(fontSize: 12, color: t.onSurfaceVariant),
              ),
              const Spacer(),
              TextButton(
                onPressed: !_dirty || _saving ? null : _save,
                child: Text(_saving ? 'Saving…' : 'Save interests'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
