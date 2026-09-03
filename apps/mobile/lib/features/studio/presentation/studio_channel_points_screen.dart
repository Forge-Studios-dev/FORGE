import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_envelope.dart';
import '../../../core/platform/platform_config.dart';
import '../../../core/theme/forge_tokens.dart';
import '../../../core/widgets/forge_button.dart';
import '../../../core/widgets/forge_card.dart';
import '../../auth/data/auth_repository.dart';

class StudioChannelPointsScreen extends ConsumerStatefulWidget {
  const StudioChannelPointsScreen({super.key});

  @override
  ConsumerState<StudioChannelPointsScreen> createState() =>
      _StudioChannelPointsScreenState();
}

class _StudioChannelPointsScreenState
    extends ConsumerState<StudioChannelPointsScreen> {
  List<Map<String, dynamic>> _communities = [];
  List<Map<String, dynamic>> _rewards = [];
  List<Map<String, dynamic>> _pending = [];
  String? _communityId;
  bool _loading = true;
  String? _busyRedemptionId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(authRepositoryProvider).refreshStoredUser() ??
          await ref.read(authRepositoryProvider).getStoredUser();
      final creatorId = user?['id'] as String?;
      if (creatorId == null) {
        setState(() => _loading = false);
        return;
      }
      final client = ref.read(apiClientProvider);
      final communitiesRes =
          await client.dio.get('/creators/$creatorId/communities');
      final communities = readApiList(communitiesRes.data);
      final communityId = _communityId ??
          (communities.isNotEmpty ? communities.first['id'] as String? : null);
      List<Map<String, dynamic>> rewards = [];
      List<Map<String, dynamic>> pending = [];
      if (communityId != null) {
        final rewardsRes = await client.dio.get(
          '/creators/me/communities/$communityId/channel-points/rewards',
        );
        final pendingRes = await client.dio.get(
          '/creators/me/communities/$communityId/channel-points/redemptions',
          queryParameters: {'status': 'pending'},
        );
        rewards = readApiList(rewardsRes.data);
        pending = readApiList(pendingRes.data);
      }
      setState(() {
        _communities = communities;
        _communityId = communityId;
        _rewards = rewards;
        _pending = pending;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _resolveRedemption(String redemptionId, {required bool approve}) async {
    if (_communityId == null) return;
    setState(() => _busyRedemptionId = redemptionId);
    try {
      final client = ref.read(apiClientProvider);
      final action = approve ? 'approve' : 'reject';
      await client.dio.post(
        '/creators/me/communities/$_communityId/channel-points/redemptions/$redemptionId/$action',
      );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(approve ? 'Approved' : 'Rejected')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update redemption')),
        );
      }
    } finally {
      if (mounted) setState(() => _busyRedemptionId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final platformConfig = ref.watch(platformConfigProvider).asData?.value ?? {};
    if (!platformChannelPointsEnabled(platformConfig)) {
      return Scaffold(
        appBar: AppBar(title: const Text('Channel points')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Channel points are disabled on this deployment.',
              style: TextStyle(color: ForgeTokens.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: ForgeTokens.background,
      appBar: AppBar(
        title: const Text('Channel points'),
        backgroundColor: ForgeTokens.surfaceContainer,
        foregroundColor: ForgeTokens.onSurface,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_communities.isEmpty)
                  const Text(
                    'Create a community to manage channel points.',
                    style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                  )
                else ...[
                  DropdownButtonFormField<String>(
                    value: _communityId,
                    decoration: const InputDecoration(labelText: 'Community'),
                    items: _communities
                        .map(
                          (c) => DropdownMenuItem(
                            value: c['id'] as String,
                            child: Text(c['name'] as String? ?? 'Community'),
                          ),
                        )
                        .toList(),
                    onChanged: (id) {
                      setState(() => _communityId = id);
                      _load();
                    },
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Rewards (${_rewards.length})',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: ForgeTokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_rewards.isEmpty)
                    const Text(
                      'No rewards yet — add them from Studio on web.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    )
                  else
                    ..._rewards.map(
                      (r) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          semanticLabel:
                              'Reward ${r['title'] ?? 'Reward'}, ${r['costPoints'] ?? 0} points',
                          child: Text(
                            '${r['title'] ?? 'Reward'} · ${r['costPoints'] ?? 0} pts',
                            style: const TextStyle(color: ForgeTokens.onSurface),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 20),
                  Text(
                    'Pending redemptions (${_pending.length})',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: ForgeTokens.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_pending.isEmpty)
                    const Text(
                      'No pending redemptions.',
                      style: TextStyle(color: ForgeTokens.onSurfaceVariant),
                    )
                  else
                    ..._pending.map((r) {
                      final id = r['id'] as String?;
                      final busy = id != null && _busyRedemptionId == id;
                      final rewardTitle = r['reward']?['title'] as String? ?? 'Reward';
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: ForgeCard(
                          semanticLabel: 'Pending redemption $rewardTitle, ${r['status']}',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$rewardTitle · ${r['status']}',
                                style: const TextStyle(color: ForgeTokens.onSurface),
                              ),
                              if (id != null) ...[
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Semantics(
                                        button: true,
                                        label: busy
                                            ? 'Approving $rewardTitle'
                                            : 'Approve redemption for $rewardTitle',
                                        child: ForgeButton(
                                          label: busy ? '…' : 'Approve',
                                          onPressed: busy
                                              ? null
                                              : () => _resolveRedemption(id, approve: true),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Semantics(
                                        button: true,
                                        label: busy
                                            ? 'Rejecting $rewardTitle'
                                            : 'Reject redemption for $rewardTitle',
                                        child: ForgeButton(
                                          label: busy ? '…' : 'Reject',
                                          onPressed: busy
                                              ? null
                                              : () => _resolveRedemption(id, approve: false),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ],
            ),
    );
  }
}
