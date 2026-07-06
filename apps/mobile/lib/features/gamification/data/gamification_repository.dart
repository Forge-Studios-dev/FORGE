import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// Mirrors the response shape of `GET /platform/gamification/me`
/// (apps/api/src/modules/gamification/gamification.controller.ts /
/// gamification.service.ts `getPlatformProfile`) — reused here rather than
/// inventing a new contract; the platform-wide XP/streak system already
/// exists server-side (used by referrals/communities/notifications).
class PlatformXpProfile {
  final int xp;
  final int level;
  final int streak;
  final int longestStreak;

  const PlatformXpProfile({
    required this.xp,
    required this.level,
    required this.streak,
    required this.longestStreak,
  });

  factory PlatformXpProfile.fromJson(Map<String, dynamic> json) => PlatformXpProfile(
        xp: (json['xp'] as num?)?.toInt() ?? 0,
        level: (json['level'] as num?)?.toInt() ?? 1,
        streak: (json['streak'] as num?)?.toInt() ?? 0,
        longestStreak: (json['longestStreak'] as num?)?.toInt() ?? 0,
      );
}

final gamificationRepositoryProvider = Provider<GamificationRepository>((ref) {
  return GamificationRepository(ref.read(apiClientProvider));
});

class GamificationRepository {
  final ApiClient _client;
  GamificationRepository(this._client);

  Future<PlatformXpProfile> getPlatformProfile() async {
    final response = await _client.dio.get('/platform/gamification/me');
    final payload = response.data['data'] as Map<String, dynamic>;
    return PlatformXpProfile.fromJson(payload);
  }
}

/// autoDispose: this is a small, cheap read shown as a best-effort chip —
/// no need to keep it alive once the feed screen is gone.
final platformXpProvider = FutureProvider.autoDispose<PlatformXpProfile>((ref) async {
  return ref.read(gamificationRepositoryProvider).getPlatformProfile();
});
