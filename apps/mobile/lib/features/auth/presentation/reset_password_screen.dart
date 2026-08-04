import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../data/auth_repository.dart';
import '../../../core/theme/forge_tokens.dart';

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.initialToken});

  final String initialToken;

  @override
  ConsumerState<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _tokenCtrl;
  final _passwordCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  static final _passwordPattern = RegExp(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)');

  @override
  void initState() {
    super.initState();
    _tokenCtrl = TextEditingController(text: widget.initialToken.trim());
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  String? _messageFromDio(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map) {
        final m = data['message'];
        if (m is String) return m;
        if (m is List) return m.cast<String>().join(', ');
      }
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authRepositoryProvider).resetPassword(
            token: _tokenCtrl.text.trim(),
            password: _passwordCtrl.text,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password updated. Sign in.')));
      context.go('/login');
    } catch (e) {
      if (mounted) {
        setState(() => _error = _messageFromDio(e) ?? 'Reset failed. The link may have expired.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _tokenFromDeepLink => widget.initialToken.trim().length >= 32;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New password'),
        leading: IconButton(
          icon: Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!_tokenFromDeepLink) ...[
                  Text(
                    'Paste the reset token from your email (or open the link from your phone).',
                    style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant, fontSize: 13, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _tokenCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Reset token',
                      prefixIcon: Icon(Icons.vpn_key_outlined),
                    ),
                    minLines: 1,
                    maxLines: 3,
                    validator: (v) {
                      final t = v?.trim() ?? '';
                      if (t.length < 32) return 'Token must be at least 32 characters';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],
                if (_error != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: ForgeTokens.of(context).error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: ForgeTokens.of(context).error.withValues(alpha: 0.35)),
                    ),
                    child: Text(_error!, style: TextStyle(color: ForgeTokens.of(context).error, fontSize: 13)),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: 'New password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) {
                    if ((v?.length ?? 0) < 8) return 'At least 8 characters';
                    if (!_passwordPattern.hasMatch(v!)) {
                      return 'Include uppercase, lowercase, and a number';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Update password'),
                ),
                TextButton(
                  onPressed: () => context.go('/forgot-password'),
                  child: const Text('Request a new link'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
