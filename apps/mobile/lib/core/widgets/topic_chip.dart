import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class TopicChip extends StatelessWidget {
  final String label;
  final bool live;

  const TopicChip({super.key, required this.label, this.live = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: ForgeTokens.surfaceContainer.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: ForgeTokens.outlineVariant.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: live ? ForgeTokens.live : ForgeTokens.secondary,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              color: ForgeTokens.onSurface,
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
