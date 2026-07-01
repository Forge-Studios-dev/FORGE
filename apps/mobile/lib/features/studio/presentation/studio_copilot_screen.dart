import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';

class _CopilotInsights {
  final String summary;
  final List<String> recommendations;
  final String growthFocus;

  const _CopilotInsights({
    required this.summary,
    required this.recommendations,
    required this.growthFocus,
  });

  factory _CopilotInsights.fromJson(Map<String, dynamic> json) => _CopilotInsights(
        summary: json['summary'] as String? ?? '',
        recommendations: (json['recommendations'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            [],
        growthFocus: json['growthFocus'] as String? ?? '',
      );
}

final _copilotInsightsProvider =
    FutureProvider.autoDispose<_CopilotInsights>((ref) async {
  final client = ref.read(apiClientProvider);

  // Fetch business analytics to provide context to the copilot
  final analyticsRes = await client.dio.get('/creators/me/business-analytics');
  final analyticsData = analyticsRes.data['data'] as Map<String, dynamic>? ?? {};

  // POST analytics context to copilot
  final insightRes = await client.dio.post(
    '/creators/me/copilot/insights',
    data: analyticsData,
  );

  final payload = insightRes.data as Map<String, dynamic>;
  return _CopilotInsights.fromJson(payload);
});

class StudioCopilotScreen extends ConsumerWidget {
  const StudioCopilotScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insightsAsync = ref.watch(_copilotInsightsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Copilot'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(_copilotInsightsProvider),
            tooltip: 'Refresh insights',
          ),
        ],
      ),
      body: insightsAsync.when(
        loading: () => const _CopilotLoadingView(),
        error: (err, _) => _CopilotErrorView(
          onRetry: () => ref.invalidate(_copilotInsightsProvider),
        ),
        data: (insights) => _CopilotInsightsView(insights: insights),
      ),
    );
  }
}

class _CopilotLoadingView extends StatelessWidget {
  const _CopilotLoadingView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text(
            'Analyzing your performance…',
            style: TextStyle(color: ForgeTokens.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _CopilotErrorView extends StatelessWidget {
  final VoidCallback onRetry;

  const _CopilotErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.psychology_outlined, size: 48, color: ForgeTokens.outline),
            const SizedBox(height: 16),
            const Text(
              'Could not load AI insights',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: ForgeTokens.onSurface,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Check your connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(color: ForgeTokens.onSurfaceVariant),
            ),
            const SizedBox(height: 24),
            ForgeButton(label: 'Try again', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

class _CopilotInsightsView extends StatelessWidget {
  final _CopilotInsights insights;

  const _CopilotInsightsView({required this.insights});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _SectionHeader(icon: Icons.auto_awesome, label: 'Summary'),
        const SizedBox(height: 8),
        ForgeCard(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              insights.summary.isNotEmpty
                  ? insights.summary
                  : 'No summary available.',
              style: const TextStyle(color: ForgeTokens.onSurface, height: 1.5),
            ),
          ),
        ),
        const SizedBox(height: 24),
        if (insights.growthFocus.isNotEmpty) ...[
          _SectionHeader(icon: Icons.rocket_launch, label: 'Top Priority'),
          const SizedBox(height: 8),
          ForgeCard(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.star, color: ForgeTokens.primary, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      insights.growthFocus,
                      style: const TextStyle(
                        color: ForgeTokens.onSurface,
                        fontWeight: FontWeight.w500,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
        if (insights.recommendations.isNotEmpty) ...[
          _SectionHeader(icon: Icons.tips_and_updates, label: 'Recommendations'),
          const SizedBox(height: 8),
          ...insights.recommendations.asMap().entries.map((entry) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ForgeCard(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: const BoxDecoration(
                            color: ForgeTokens.primary,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${entry.key + 1}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            entry.value,
                            style: const TextStyle(
                              color: ForgeTokens.onSurface,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )),
        ],
        const SizedBox(height: 16),
        Text(
          'Insights are generated from your recent analytics and may take a moment to reflect latest data.',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            color: ForgeTokens.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SectionHeader({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: ForgeTokens.primary),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 15,
            color: ForgeTokens.onSurface,
          ),
        ),
      ],
    );
  }
}
