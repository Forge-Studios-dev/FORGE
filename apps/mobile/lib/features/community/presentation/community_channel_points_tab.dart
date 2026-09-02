import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../auth/data/auth_repository.dart';
import '../data/community_repository.dart';

/// Member channel points: balance + redeem rewards.
class CommunityChannelPointsTab extends ConsumerStatefulWidget {
  const CommunityChannelPointsTab({super.key, required this.communityId});

  final String communityId;

  @override
  ConsumerState<CommunityChannelPointsTab> createState() =>
      _CommunityChannelPointsTabState();
}

class _CommunityChannelPointsTabState
    extends ConsumerState<CommunityChannelPointsTab> {
  int _balance = 0;
  int _totalEarned = 0;
  List<Map<String, dynamic>> _rewards = [];
  bool _loading = true;
  bool _signedIn = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final user = await ref.read(authRepositoryProvider).getStoredUser();
      _signedIn = user != null;
      final repo = ref.read(communityRepositoryProvider);
      final rewards = await repo.listChannelPointRewards(widget.communityId);
      var balance = 0;
      var earned = 0;
      if (_signedIn) {
        final me = await repo.getChannelPointsBalance(widget.communityId);
        balance = (me['balance'] as num?)?.toInt() ?? 0;
        earned = (me['totalEarned'] as num?)?.toInt() ?? 0;
      }
      if (!mounted) return;
      setState(() {
        _rewards = rewards;
        _balance = balance;
        _totalEarned = earned;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load channel points';
      });
    }
  }

  Future<void> _redeem(String rewardId) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(communityRepositoryProvider)
          .redeemChannelPointReward(widget.communityId, rewardId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Redemption submitted')),
        );
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not redeem reward')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!, textAlign: TextAlign.center));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Your balance', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (!_signedIn)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sign in to earn and redeem points.',
                style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
              ),
              const SizedBox(height: 8),
              ForgeButton(
                label: 'Sign in',
                onPressed: () => context.push('/login'),
              ),
            ],
          )
        else
          Text(
            '$_balance points · $_totalEarned earned all-time',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
        const SizedBox(height: 24),
        Text('Rewards', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        if (_rewards.isEmpty)
          Text(
            'No rewards available yet.',
            style: TextStyle(color: ForgeTokens.of(context).onSurfaceVariant),
          )
        else
          ..._rewards.map((reward) {
            final id = reward['id'] as String;
            final cost = (reward['costPoints'] as num?)?.toInt() ?? 0;
            final canAfford = _signedIn && _balance >= cost;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(reward['title'] as String? ?? 'Reward'),
                subtitle: Text(
                  [
                    '$cost pts',
                    if (reward['requiresApproval'] == true) 'Needs approval',
                    if (reward['description'] != null) reward['description'],
                  ].join(' · '),
                ),
                trailing: _signedIn
                    ? TextButton(
                        onPressed: (!_busy && canAfford) ? () => _redeem(id) : null,
                        child: const Text('Redeem'),
                      )
                    : null,
              ),
            );
          }),
      ],
    );
  }
}
