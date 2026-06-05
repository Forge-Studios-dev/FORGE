import 'package:flutter/material.dart';

import '../../core/theme/forge_tokens.dart';
import '../../features/profile/presentation/membership_panel.dart';

String accessDeniedMessage(String? reason) {
  switch (reason) {
    case 'login_required':
      return 'Sign in to watch this content.';
    case 'follow_required':
      return 'Follow this creator to watch.';
    case 'subscription_required':
      return 'An active membership is required.';
    case 'tier_required':
      return 'A higher membership tier is required.';
    case 'private':
      return 'This content is private.';
    default:
      return 'You do not have access to this content.';
  }
}

/// Membership CTA for gated VOD/live when API returns `accessDenied: true`.
class GatedContentPanel extends StatelessWidget {
  final String creatorId;
  final String? accessReason;

  const GatedContentPanel({
    super.key,
    required this.creatorId,
    this.accessReason,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ForgeTokens.surfaceContainerHighest,
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock_outline, size: 40, color: ForgeTokens.outline),
          const SizedBox(height: 12),
          Text(
            accessDeniedMessage(accessReason),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              color: ForgeTokens.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          MembershipPanel(creatorId: creatorId),
        ],
      ),
    );
  }
}
