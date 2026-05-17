import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/auth_repository.dart';

final _rejectedProfileProvider = FutureProvider.autoDispose<_UserSummary>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/users/me');
  final m = response.data['data'] as Map<String, dynamic>;
  return _UserSummary(
    displayName: m['displayName'] as String? ?? '',
    creatorReviewNote: m['creatorReviewNote'] as String?,
  );
});

class _UserSummary {
  final String displayName;
  final String? creatorReviewNote;
  _UserSummary({required this.displayName, this.creatorReviewNote});
}

class ApprovalRejectedScreen extends ConsumerWidget {
  const ApprovalRejectedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncMe = ref.watch(_rejectedProfileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Creator request')),
      body: asyncMe.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('Could not load your profile.'),
                const SizedBox(height: 16),
                FilledButton(onPressed: () => ref.invalidate(_rejectedProfileProvider), child: const Text('Retry')),
              ],
            ),
          ),
        ),
        data: (me) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Your creator request was rejected.',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              if (me.displayName.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(me.displayName, style: const TextStyle(color: Colors.grey)),
              ],
              if (me.creatorReviewNote != null && me.creatorReviewNote!.isNotEmpty) ...[
                const SizedBox(height: 20),
                const Text('Reason', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Text(me.creatorReviewNote!, style: const TextStyle(color: Colors.grey)),
              ],
              const SizedBox(height: 28),
              FilledButton(
                onPressed: () async {
                  try {
                    await ref.read(authRepositoryProvider).requestCreator();
                    if (context.mounted) context.go('/waiting-approval');
                  } catch (_) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not submit a new request.')),
                      );
                    }
                  }
                },
                child: const Text('Request again'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/feed'),
                child: const Text('Go to feed'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
