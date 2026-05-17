import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_card.dart';

class StudioPlaceholderScreen extends StatelessWidget {
  final String title;
  final String subtitle;

  const StudioPlaceholderScreen({
    super.key,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/studio'),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(subtitle, style: const TextStyle(color: ForgeTokens.onSurfaceVariant)),
          const SizedBox(height: 16),
          const ForgeCard(
            child: Text(
              'Full metrics and controls will sync with the web studio as APIs expand.',
              style: TextStyle(color: ForgeTokens.onSurfaceVariant, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
