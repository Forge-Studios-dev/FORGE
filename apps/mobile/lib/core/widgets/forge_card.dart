import 'package:flutter/material.dart';
import '../theme/forge_tokens.dart';

class ForgeCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  /// Optional VoiceOver / TalkBack label. When [onTap] is set, the card is
  /// exposed as a button; prefer an explicit label for skill Studio lists.
  final String? semanticLabel;

  const ForgeCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.semanticLabel,
  });

  @override
  State<ForgeCard> createState() => _ForgeCardState();
}

class _ForgeCardState extends State<ForgeCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final t = ForgeTokens.of(context);
    final content = Padding(
      padding: widget.padding ?? const EdgeInsets.all(16),
      child: widget.child,
    );

    final card = AnimatedScale(
      scale: _pressed ? 0.98 : 1,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOutCubic,
      child: Material(
        color: t.surfaceContainer.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(16),
        elevation: _pressed ? 0 : 2,
        shadowColor: Colors.black54,
        child: InkWell(
          onTap: widget.onTap,
          onHighlightChanged: (v) => setState(() => _pressed = v),
          borderRadius: BorderRadius.circular(16),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _pressed
                    ? t.primary.withValues(alpha: 0.5)
                    : t.outlineVariant.withValues(alpha: 0.4),
              ),
            ),
            child: content,
          ),
        ),
      ),
    );

    if (widget.semanticLabel == null && widget.onTap == null) return card;

    return Semantics(
      button: widget.onTap != null,
      label: widget.semanticLabel,
      child: card,
    );
  }
}
