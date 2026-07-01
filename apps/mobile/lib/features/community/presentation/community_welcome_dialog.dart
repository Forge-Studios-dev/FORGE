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
        'You now have member access. Explore text and voice rooms, join events '
        'and challenges, and connect with the community from the Rooms tab.',
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
