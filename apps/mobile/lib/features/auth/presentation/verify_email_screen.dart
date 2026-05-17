import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../data/auth_repository.dart';
import '../../profile/presentation/profile_screen.dart';

class VerifyEmailScreen extends ConsumerStatefulWidget {
  final String initialToken;

  const VerifyEmailScreen({super.key, required this.initialToken});

  @override
  ConsumerState<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends ConsumerState<VerifyEmailScreen> {
  String _status = 'loading';
  String _message = '';

  @override
  void initState() {
    super.initState();
    final token = widget.initialToken.trim();
    if (token.length < 16) {
      _status = 'err';
      _message = 'Invalid or missing verification token.';
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
              if (_status == 'loading') const CircularProgressIndicator(),
              if (_status == 'ok') ...[
                const Icon(Icons.check_circle, color: Colors.green, size: 56),
                const SizedBox(height: 16),
                Text(_message, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.go('/feed'),
                  child: const Text('Continue'),
                ),
              ],
              if (_status == 'err') ...[
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 56),
                const SizedBox(height: 16),
                Text(_message, textAlign: TextAlign.center),
                const SizedBox(height: 8),
                const Text(
                  'After signing in, open Profile and tap “Resend verification email” for a new link.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => context.go('/login'),
                  child: const Text('Back to login'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
