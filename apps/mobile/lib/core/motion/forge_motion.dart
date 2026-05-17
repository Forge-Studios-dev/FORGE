import 'package:flutter/material.dart';

/// Lightweight motion helpers aligned with @forge/design-system motion tokens.
abstract final class ForgeMotion {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 360);
  static const Curve ease = Curves.easeOutCubic;

  /// Fade + slide entrance for list/grid children.
  static Widget fadeIn({
    required Widget child,
    int index = 0,
    Duration? delay,
  }) {
    final d = delay ?? Duration(milliseconds: (index * 40).clamp(0, 320));
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: normal + d,
      curve: ease,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 8 * (1 - value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
