import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/access/creator_status_provider.dart';
import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../../core/theme/forge_tokens.dart';

class VerifyEmailScreen extends ConsumerStatefulWidget {
  final String initialToken;

  const VerifyEmailScreen({super.key, required this.initialToken});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  String _status = 'loading';
  String _message = '';
  bool _resending = false;

  @override
  void initState() {
    super.initState();
    final token = widget.initialToken.trim();
    if (token.length < 16) {
      _status = 'prompt';
      _message = 'Check your inbox for the verification link, or resend it below.';
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _runVerify(token));
  }

  Future<void> _runVerify(String token) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.get('/auth/verify-email', queryParameters: {'token': token});
      await ref.read(authRepositoryProvider).refreshStoredUser();
      ref.invalidate(userProfileProvider('me'));
      ref.invalidate(creatorTierProvider);
      if (!mounted) return;
      setState(() {
        _status = 'ok';
        _message = 'Your email is verified. You can continue to FORGE.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _status = 'err';
        _message = 'Verification failed. The link may have expired.';
      });
    }
  }

  Future<void> _resend() async {
    setState(() => _resending = true);
    try {
      await ref.read(authRepositoryProvider).resendVerificationEmail();
      if (!mounted) return;
      setState(() {
        _message = 'Verification email sent. Check your inbox.';
        _status = 'prompt';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'Could not send email. Try again later.');
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify email')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (_status == 'loading') CircularProgressIndicator(),
              if (_status == 'ok') ...[
                Icon(Icons.check_circle, color: Colors.green, size: 56),
                const SizedBox(height: 16),
                Text(_message, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.go('/feed'),
                  child: const Text('Continue'),
                ),
              ],
              if (_status == 'prompt' || _status == 'err') ...[
                Icon(
                  _status == 'err' ? Icons.error_outline : Icons.mail_outline,
                  color: _status == 'err' ? ForgeTokens.of(context).error : ForgeTokens.of(context).warning,
                  size: 56,
                ),
                const SizedBox(height: 16),
                Text(_message, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _resending ? null : _resend,
                  child: _resending
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Resend verification email'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => context.go('/feed'),
                  child: const Text('Continue browsing'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
