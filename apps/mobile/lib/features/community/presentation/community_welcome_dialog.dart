import 'package:flutter/material.dart';

/// Member welcome onboarding nudge — mobile parity with the web
/// `CommunityWelcomeModal`. Shown once per community to non-creator members.
Future<void> showCommunityWelcomeDialog(
  BuildContext context,
  String communityName,
) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => AlertDialog(
      title: Text('Welcome to $communityName'),
      content: const Text(
        'You now have member access. Explore posts, polls, text and voice rooms, '
        'and events from the community tabs.',
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Start exploring'),
        ),
      ],
    ),
  );
}
