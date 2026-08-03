import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class TopicChip extends StatelessWidget {
  final String label;
  final bool live;

  const TopicChip({super.key, required this.label, this.live = false});

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: t.surfaceContainer.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.outlineVariant.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: live ? t.live : t.secondary,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              color: t.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

/// @deprecated Use [TopicChip]
class SkillChip extends TopicChip {
  const SkillChip({super.key, required super.label, super.live = false});
}
