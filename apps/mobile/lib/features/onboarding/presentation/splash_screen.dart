import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/forge_tokens.dart';
import '../data/onboarding_storage.dart';

const _storage = FlutterSecureStorage();

/// Cold-launch splash. Performs the auth/onboarding decision once (in
/// parallel with the router's own `_redirect`, which handles all
/// *subsequent* navigations) and routes to the right place:
/// `/login` (no session), `/onboarding` (first-time signed-in user), or
/// `/feed` (returning signed-in user).
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _decide());
  }

  Future<void> _decide() async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (!mounted) return;
    if (token == null || token.isEmpty) {
      context.go('/login');
      return;
    }
    final done = await isOnboardingComplete();
    if (!mounted) return;
    context.go(done ? '/feed' : '/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ForgeTokens.of(context).background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'FORGE',
              style: TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 40,
                letterSpacing: 1.5,
                color: ForgeTokens.of(context).primary,
              ),
            ),
            const SizedBox(height: 24),
            CircularProgressIndicator(color: ForgeTokens.of(context).primary),
          ],
        ),
      ),
    );
  }
}
