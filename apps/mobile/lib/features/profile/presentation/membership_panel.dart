import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/network/api_client.dart';
import '../../auth/data/auth_repository.dart';

final creatorBundlesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, creatorId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.dio.get('/creators/$creatorId/bundles');
  final list = response.data['data'] as List? ?? [];
  return list.cast<Map<String, dynamic>>();
});

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
  final String? communityId;
  const MembershipPanel({super.key, required this.creatorId, this.communityId});

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
            final bundlesAsync = ref.watch(creatorBundlesProvider(creatorId));
            if (tiers.isEmpty && (bundlesAsync.value ?? []).isEmpty) {
              return const SizedBox.shrink();
            }
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
                            onPressed: () => _checkout(context, ref, tier['id'] as String),
                            child: const Text('Join'),
                          ),
                        ],
                      ),
                    );
                  }),
                  ...?bundlesAsync.whenOrNull(
                    data: (bundles) => bundles.map((bundle) {
                      final tier = bundle['tier'] as Map<String, dynamic>?;
                      final priceCents = tier?['priceCents'] as int? ?? 0;
                      final currency = tier?['currency'] as String? ?? 'USD';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Bundle: ${bundle['name']} — $currency ${(priceCents / 100).toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            TextButton(
                              onPressed: () => _checkout(context, ref, bundle['tierId'] as String),
                              child: const Text('Get bundle'),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _checkout(BuildContext context, WidgetRef ref, String tierId) async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.dio.post('/billing/checkout', data: {
        'creatorId': creatorId,
        'tierId': tierId,
        if (communityId != null) 'communityId': communityId,
        'successUrl': 'https://forgestudios.net/settings/memberships',
        'cancelUrl': 'https://forgestudios.net/settings/memberships',
      });
      final checkoutUrl = response.data['data']?['checkoutUrl'] as String?;
      if (checkoutUrl != null && checkoutUrl.isNotEmpty) {
        final uri = Uri.parse(checkoutUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open checkout. Try joining on the web.')),
          );
        }
        return;
      }
      // The checkout call succeeded but returned no hosted URL — this only
      // happens with the stub provider in dev/staging, where mock subscriptions
      // are enabled server-side. Use the test-membership path there.
      await _mockJoin(context, ref, tierId);
    } on DioException catch (e) {
      // A genuine checkout failure (e.g. creator hasn't finished payout
      // onboarding, or the user isn't signed in) must surface — never silently
      // grant a test membership, which would mask the real problem.
      if (!context.mounted) return;
      final status = e.response?.statusCode;
      final data = e.response?.data;
      final serverMessage = data is Map ? data['message'] : null;
      final message = status == 401
          ? 'Sign in to join this membership.'
          : (serverMessage is String && serverMessage.isNotEmpty
              ? serverMessage
              : 'Could not start checkout. Please try again.');
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not start checkout. Please try again.')),
      );
    }
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
          const SnackBar(content: Text('Sign in to join')),
        );
      }
    }
  }
}
