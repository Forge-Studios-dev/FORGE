import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../data/auth_repository.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';

/// Second step of login when the account has TOTP enabled — pushed directly
/// (not a named route) since it only ever follows a successful password
/// check and carries a short-lived, single-use challenge token.
class MfaChallengeScreen extends ConsumerStatefulWidget {
  const MfaChallengeScreen({super.key, required this.challengeToken, required this.next});

  final String challengeToken;
  final String? next;

  @override
  ConsumerState<MfaChallengeScreen> createState() => _MfaChallengeScreenState();
}

class _MfaChallengeScreenState extends ConsumerState<MfaChallengeScreen> {
  final _codeCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(authRepositoryProvider).completeMfaLogin(
            challengeToken: widget.challengeToken,
            code: _codeCtrl.text.trim(),
          );
      if (!mounted) return;
      final user = data['user'] as Map<String, dynamic>?;
      if (user != null &&
          user['role'] == 'creator' &&
          user['creatorStatus'] != null &&
          user['creatorStatus'] != 'approved') {
        context.go(user['creatorStatus'] == 'rejected' ? '/approval-rejected' : '/waiting-approval');
        return;
      }
      context.go(widget.next != null && widget.next!.isNotEmpty ? widget.next! : '/feed');
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data['message'] : null;
      setState(() => _error = msg is String ? msg : 'Invalid or expired code. Try again.');
    } catch (_) {
      setState(() => _error = 'Invalid or expired code. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor verification')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Enter the 6-digit code from your authenticator app, or a backup code.',
                style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
              ),
              const SizedBox(height: 24),
              if (_error != null) ...[
                Text(_error!, style: TextStyle(color: ForgeTokens.of(context).error, fontSize: 13)),
                const SizedBox(height: 16),
              ],
              TextField(
                controller: _codeCtrl,
                keyboardType: TextInputType.number,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Verification code'),
                onSubmitted: (_) => _loading ? null : _submit(),
              ),
              const SizedBox(height: 24),
              ForgeButton(
                label: _loading ? 'Verifying…' : 'Verify',
                onPressed: _loading ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
