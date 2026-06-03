import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../auth/data/auth_repository.dart';

final creatorTiersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/tiers');
  final list = response.data['data'] as List? ?? [];
  return list.cast<Map<String, dynamic>>();
});

final myMembershipProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, String>((ref, creatorId) async {
  final loggedIn = await ref.read(authRepositoryProvider).isLoggedIn();
  if (!loggedIn) return null;
  try {
    final client = ref.read(apiClientProvider);
    final response = await client.dio.get('/creators/$creatorId/membership/me');
    return response.data['data'] as Map<String, dynamic>;
  } catch (_) {
    return null;
  }
});

class MembershipPanel extends ConsumerWidget {
  final String creatorId;
  const MembershipPanel({super.key, required this.creatorId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membershipAsync = ref.watch(myMembershipProvider(creatorId));
    final tiersAsync = ref.watch(creatorTiersProvider(creatorId));

    return membershipAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (membership) {
        if (membership?['active'] == true) {
          final tier = membership?['subscription']?['tier'] as Map<String, dynamic>?;
          final tierName = tier?['name'] as String? ?? 'Member';
          final isTest = membership?['isTestMembership'] == true;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    tierName,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
                if (isTest) ...[
                  const SizedBox(width: 8),
                  Text(
                    'Test',
                    style: TextStyle(color: Colors.amber.shade300, fontSize: 11),
                  ),
                ],
              ],
            ),
          );
        }

        return tiersAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (tiers) {
            if (tiers.isEmpty) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Become a member', style: TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  ...tiers.map((tier) {
                    final priceCents = tier['priceCents'] as int? ?? 0;
                    final currency = tier['currency'] as String? ?? 'USD';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${tier['name']} — $currency ${(priceCents / 100).toStringAsFixed(0)}/mo',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          TextButton(
                            onPressed: () => _mockJoin(context, ref, tier['id'] as String),
                            child: const Text('Join (test)'),
                          ),
                        ],
                      ),
                    );
                  }),
                  const Text(
                    'Test memberships only — billing in Phase 2.',
                    style: TextStyle(color: Colors.grey, fontSize: 11),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _mockJoin(BuildContext context, WidgetRef ref, String tierId) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.dio.post('/subscriptions/mock', data: {
        'creatorId': creatorId,
        'tierId': tierId,
      });
      ref.invalidate(myMembershipProvider(creatorId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Membership activated (test)')),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to join (test mode)')),
        );
      }
    }
  }
}
