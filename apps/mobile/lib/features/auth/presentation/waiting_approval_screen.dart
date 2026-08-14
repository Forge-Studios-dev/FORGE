import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';

class WaitingApprovalScreen extends StatelessWidget {
  const WaitingApprovalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Creator approval')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Your creator request is under review.',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Text(
              'You can still browse and watch videos while you wait.',
              style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
            ),
            const SizedBox(height: 32),
            FilledButton(
              onPressed: () => context.go('/explore'),
              child: const Text('Explore videos while you wait'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go('/feed'),
              child: const Text('Go to feed'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => context.go('/login'),
              child: const Text('Switch account'),
            ),
          ],
        ),
      ),
    );
  }
}
